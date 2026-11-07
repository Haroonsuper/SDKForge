import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

/** Validated runtime configuration. The process refuses to start if anything is missing. */
export const config = {
  port: Number(process.env.PORT ?? 4000),
  isProduction: process.env.NODE_ENV === 'production',
  appUrl: required('APP_URL').replace(/\/+$/, ''),
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  stripeSecretKey: required('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: required('STRIPE_WEBHOOK_SECRET'),
  prices: {
    growth_pro: required('STRIPE_PRICE_GROWTH_PRO'),
    enterprise_scale: required('STRIPE_PRICE_ENTERPRISE_SCALE')
  }
} as const;
