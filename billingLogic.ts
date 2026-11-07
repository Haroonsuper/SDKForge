/**
 * Pure billing rules (no I/O) so they can be unit-tested without Stripe or Supabase.
 * Plan matrix: Starter (free, 20 builds) | Growth Pro ($49/mo, 500 builds) | Enterprise Scale ($249/mo, unlimited).
 */

export type PlanTier = 'starter' | 'growth_pro' | 'enterprise_scale';

export type DbSubscriptionStatus =
  | 'active' | 'trialing' | 'past_due' | 'unpaid' | 'canceled'
  | 'incomplete' | 'incomplete_expired' | 'paused';

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  priceUsdPerMonth: number;
  /** null = unlimited */
  monthlyQuota: number | null;
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  starter: { tier: 'starter', name: 'Starter', priceUsdPerMonth: 0, monthlyQuota: 20 },
  growth_pro: { tier: 'growth_pro', name: 'Growth Pro', priceUsdPerMonth: 49, monthlyQuota: 500 },
  enterprise_scale: { tier: 'enterprise_scale', name: 'Enterprise Scale', priceUsdPerMonth: 249, monthlyQuota: null }
};

export interface PriceMap {
  growth_pro: string;
  enterprise_scale: string;
}

/** Maps a Stripe price id to a plan tier. Returns null for unknown prices. */
export function tierFromPriceId(priceId: string | null | undefined, prices: PriceMap): PlanTier | null {
  if (!priceId) return null;
  if (priceId === prices.growth_pro) return 'growth_pro';
  if (priceId === prices.enterprise_scale) return 'enterprise_scale';
  return null;
}

const KNOWN_STATUSES: readonly DbSubscriptionStatus[] = [
  'active', 'trialing', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused'
];

/** Normalises any Stripe subscription status into the Postgres enum. Unknown values are treated as 'incomplete' (fail closed). */
export function mapStripeStatus(status: string | null | undefined): DbSubscriptionStatus {
  return (KNOWN_STATUSES as readonly string[]).includes(status ?? '')
    ? (status as DbSubscriptionStatus)
    : 'incomplete';
}

export interface ProfileBillingUpdate {
  plan_tier: PlanTier;
  monthly_quota: number | null;
  subscription_status: DbSubscriptionStatus;
}

/** Statuses for which the customer no longer has paid entitlement: they fall back to the free plan. */
const LOST_ENTITLEMENT: readonly DbSubscriptionStatus[] = ['canceled', 'unpaid', 'incomplete_expired'];

/**
 * Computes the profile columns to write for a given paid tier + Stripe status.
 *  - active / trialing        -> tier and quota of the purchased plan
 *  - past_due / paused / ...  -> tier kept, status recorded (database blocks new builds until payment recovers)
 *  - canceled / unpaid / expired -> downgraded to Starter
 */
export function resolveProfileUpdate(tier: PlanTier, status: DbSubscriptionStatus): ProfileBillingUpdate {
  if (LOST_ENTITLEMENT.includes(status)) return downgradeToStarter(status);
  return {
    plan_tier: tier,
    monthly_quota: PLANS[tier].monthlyQuota,
    subscription_status: status
  };
}

export function downgradeToStarter(status: DbSubscriptionStatus = 'canceled'): ProfileBillingUpdate {
  return {
    plan_tier: 'starter',
    monthly_quota: PLANS.starter.monthlyQuota,
    subscription_status: status
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function isPaidTier(value: unknown): value is Exclude<PlanTier, 'starter'> {
  return value === 'growth_pro' || value === 'enterprise_scale';
}
