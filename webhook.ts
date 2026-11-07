import express, { Router } from 'express';
import type Stripe from 'stripe';
import { config } from '../config.js';
import { stripe, supabaseAdmin } from '../clients.js';
import {
  downgradeToStarter, isUuid, mapStripeStatus, resolveProfileUpdate, tierFromPriceId,
  type ProfileBillingUpdate
} from '../billingLogic.js';

export const webhookRouter = Router();

/**
 * POST /webhooks/stripe
 * The body MUST stay raw (Buffer): Stripe signs the exact bytes, so express.json() must not run before this route.
 */
webhookRouter.post('/stripe', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  const signature = req.header('stripe-signature');
  if (!signature || !Buffer.isBuffer(req.body)) {
    res.status(400).json({ error: 'Missing signature or raw body.' });
    return;
  }

  let event: Stripe.Event;
  try {
    // Verifies the HMAC signature AND the timestamp tolerance (replay protection).
    event = stripe.webhooks.constructEvent(req.body, signature, config.stripeWebhookSecret);
  } catch (err) {
    console.warn('[stripe] signature verification failed:', (err as Error).message);
    res.status(400).json({ error: 'Invalid signature.' });
    return;
  }

  try {
    // Idempotency: Stripe may deliver the same event more than once.
    const { data: seen, error: seenError } = await supabaseAdmin
      .from('stripe_events').select('id').eq('id', event.id).maybeSingle();
    if (seenError) throw seenError;
    if (seen) {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    await handleEvent(event);

    const { error: logError } = await supabaseAdmin
      .from('stripe_events').upsert({ id: event.id, type: event.type }, { onConflict: 'id', ignoreDuplicates: true });
    if (logError) throw logError;

    res.status(200).json({ received: true });
  } catch (err) {
    // 5xx => Stripe retries with exponential backoff. Handlers write absolute state, so retries are safe.
    console.error(`[stripe] failed to process ${event.type} (${event.id})`, err);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      return;
    case 'customer.subscription.updated':
      await onSubscriptionChanged(event.data.object as Stripe.Subscription);
      return;
    case 'customer.subscription.deleted':
      await onSubscriptionDeleted(event.data.object as Stripe.Subscription);
      return;
    default:
      // Unhandled event types are acknowledged so Stripe does not retry them.
      return;
  }
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

/** Current period end moved from the subscription to its items in newer Stripe API versions; support both. */
function periodEndIso(sub: Stripe.Subscription): string | null {
  const fromItem = (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end;
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const seconds = fromItem ?? legacy;
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null;
}

async function applyUpdate(
  target: { userId: string | null; customerId: string | null },
  update: ProfileBillingUpdate & {
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    current_period_end?: string | null;
  }
): Promise<void> {
  let query = supabaseAdmin.from('profiles').update(update);
  if (target.userId) query = query.eq('id', target.userId);
  else if (target.customerId) query = query.eq('stripe_customer_id', target.customerId);
  else throw new Error('Cannot map Stripe event to a user (no user id or customer id).');

  const { data, error } = await query.select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(`No profile found for ${target.userId ? `user ${target.userId}` : `customer ${target.customerId}`}`);
  }
}

/** checkout.session.completed -> link the Stripe customer + subscription to the user and activate the plan. */
async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== 'subscription') return;

  const userId = isUuid(session.client_reference_id) ? session.client_reference_id
    : isUuid(session.metadata?.user_id) ? session.metadata!.user_id! : null;
  const customerId = idOf(session.customer as string | { id: string } | null);
  const subscriptionId = idOf(session.subscription as string | { id: string } | null);
  if (!userId || !customerId || !subscriptionId) {
    throw new Error(`checkout.session ${session.id} is missing user, customer or subscription reference`);
  }

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = sub.items.data[0]?.price?.id;
  const tier = tierFromPriceId(priceId, config.prices);
  if (!tier) throw new Error(`Unknown Stripe price ${priceId ?? '(none)'} on subscription ${sub.id}`);

  await applyUpdate(
    { userId, customerId },
    {
      ...resolveProfileUpdate(tier, mapStripeStatus(sub.status)),
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      current_period_end: periodEndIso(sub)
    }
  );
}

/** customer.subscription.updated -> plan changes, renewals, payment failures, cancellations at period end. */
async function onSubscriptionChanged(sub: Stripe.Subscription): Promise<void> {
  const customerId = idOf(sub.customer as string | { id: string });
  const metaUser = sub.metadata?.user_id;
  const userId = isUuid(metaUser) ? metaUser : null;

  const priceId = sub.items.data[0]?.price?.id;
  const tier = tierFromPriceId(priceId, config.prices);
  if (!tier) throw new Error(`Unknown Stripe price ${priceId ?? '(none)'} on subscription ${sub.id}`);

  await applyUpdate(
    { userId, customerId },
    {
      ...resolveProfileUpdate(tier, mapStripeStatus(sub.status)),
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      current_period_end: periodEndIso(sub)
    }
  );
}

/** customer.subscription.deleted -> back to the free Starter plan. */
async function onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const customerId = idOf(sub.customer as string | { id: string });
  const metaUser = sub.metadata?.user_id;
  const userId = isUuid(metaUser) ? metaUser : null;

  // Ignore a deletion of an OLD subscription when the user already has a newer one.
  const { data: current, error } = await supabaseAdmin
    .from('profiles').select('stripe_subscription_id')
    .match(userId ? { id: userId } : { stripe_customer_id: customerId ?? '' }).maybeSingle();
  if (error) throw error;
  if (current?.stripe_subscription_id && current.stripe_subscription_id !== sub.id) return;

  await applyUpdate(
    { userId, customerId },
    { ...downgradeToStarter('canceled'), stripe_subscription_id: null, current_period_end: null }
  );
}
