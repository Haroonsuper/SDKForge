import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

/** Stripe SDK (uses the API version pinned by the installed library). */
export const stripe = new Stripe(config.stripeSecretKey, {
  maxNetworkRetries: 2,
  timeout: 20_000,
  appInfo: { name: 'sdkforge-billing-api', version: '1.0.0' }
});

/**
 * Supabase client authenticated with the SERVICE ROLE key. It bypasses Row Level Security,
 * which is exactly what the webhook needs - and why this key must never leave the server.
 */
export const supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
