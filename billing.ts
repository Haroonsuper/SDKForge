import { Router } from 'express';
import { config } from '../config.js';
import { stripe, supabaseAdmin } from '../clients.js';
import { requireUser } from '../auth.js';
import { isPaidTier } from '../billingLogic.js';

export const billingRouter = Router();
billingRouter.use(requireUser);

/** Returns the existing Stripe customer of the user or creates one (and stores its id). */
async function ensureStripeCustomer(userId: string, email: string | undefined): Promise<string> {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles').select('stripe_customer_id').eq('id', userId).single();
  if (error) throw error;
  if (profile.stripe_customer_id) return profile.stripe_customer_id as string;

  const customer = await stripe.customers.create(
    { email, metadata: { user_id: userId } },
    { idempotencyKey: `customer-${userId}` }
  );
  const { error: saveError } = await supabaseAdmin
    .from('profiles').update({ stripe_customer_id: customer.id }).eq('id', userId);
  if (saveError) throw saveError;
  return customer.id;
}

/** POST /api/billing/checkout  { "tier": "growth_pro" | "enterprise_scale" } -> { url } */
billingRouter.post('/checkout', async (req, res) => {
  try {
    const tier = (req.body as { tier?: unknown } | undefined)?.tier;
    if (!isPaidTier(tier)) {
      res.status(400).json({ error: 'tier must be "growth_pro" or "enterprise_scale".' });
      return;
    }
    const user = req.user!;
    const customerId = await ensureStripeCustomer(user.id, user.email);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: config.prices[tier], quantity: 1 }],
      subscription_data: { metadata: { user_id: user.id } },
      metadata: { user_id: user.id },
      allow_promotion_codes: true,
      success_url: `${config.appUrl}/?billing=success`,
      cancel_url: `${config.appUrl}/?billing=cancelled`
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing] checkout failed', err);
    res.status(500).json({ error: 'Could not start checkout.' });
  }
});

/** POST /api/billing/portal -> { url } (Stripe customer portal: change plan, update card, cancel). */
billingRouter.post('/portal', async (req, res) => {
  try {
    const user = req.user!;
    const customerId = await ensureStripeCustomer(user.id, user.email);
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${config.appUrl}/`
    });
    res.json({ url: portal.url });
  } catch (err) {
    console.error('[billing] portal failed', err);
    res.status(500).json({ error: 'Could not open the billing portal.' });
  }
});
