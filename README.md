# SDKForge - OpenAPI / Swagger / Postman to SDK platform

Deterministic (no AI) SDK generator: upload an OpenAPI 3.x, Swagger 2.0 or Postman v2/v2.1 document
(JSON **or YAML**) and get type-safe SDKs for TypeScript (fetch/axios), Python (requests, httpx sync/async)
and Go (custom http.Client hook, context.Context everywhere) as a ZIP.

```
/                      React 19 + Vite + Tailwind workbench (Ingestion, Code Studio, Playground, Builds, Blueprint)
/src/engine            Parser + generators + sanitizer (pure TypeScript, zero AI)
/supabase/migrations   0001_init.sql  multi-tenant schema, RLS, quota trigger, storage policies
/backend               Express + Stripe webhook / checkout / portal API (service-role Supabase access)
```

## 1. Web app

```bash
npm install
npm run dev        # http://127.0.0.1:3000
npm run build
```

## 2. Database (Supabase)

1. Create a Supabase project, open **SQL Editor**, run `supabase/migrations/0001_init.sql`
   (or `supabase db push`).
2. Tenancy: `organizations -> workspaces -> projects -> sdk_builds`, members with roles
   (owner/admin/developer/viewer). Every table has RLS keyed on `auth.uid()`.
3. A signup trigger creates the profile, a personal organization and a default workspace.
4. Billing columns (`plan_tier`, `monthly_quota`, `subscription_status`, Stripe ids) are **not writable**
   by logged-in users, only by the service role (the webhook).
5. `sdk_builds` is an immutable history (unique `commit_hash`, runtime stats). A trigger enforces the monthly
   quota of the organization owner's plan (Starter 20 / Growth Pro 500 / Enterprise unlimited).

## 3. Billing API (Stripe)

```bash
cd backend
cp .env.example .env     # fill in Supabase + Stripe values
npm install
npm test                 # unit tests for plan / status mapping
npm run dev
```

Stripe dashboard setup:
- Create two recurring monthly prices: Growth Pro $49, Enterprise Scale $249; put their ids in `.env`.
- Add a webhook endpoint `https://YOUR-API/webhooks/stripe` for `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`; copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
- Local testing: `stripe listen --forward-to localhost:4000/webhooks/stripe`.

Endpoints: `POST /webhooks/stripe`, `POST /api/billing/checkout {tier}`, `POST /api/billing/portal`
(both need `Authorization: Bearer <supabase access token>`), `GET /healthz`.

## Security summary

- Spec content is sanitized before it reaches any template (no code injection into generated SDKs).
- 5 MB upload limit, endpoint/schema caps, YAML alias-bomb protection, `$ref` pointer guards.
- Webhook: raw-body signature verification with replay tolerance, idempotency table, absolute-state updates.
- Service-role key only on the server; CORS allow-list, helmet, rate limiting, 10 KB JSON body limit.
- Production build ships a Content-Security-Policy.

## Not wired yet

The browser app still stores projects/builds locally (demo mode). Connecting it to Supabase
(`@supabase/supabase-js` auth + the tables above) and to the checkout endpoint is the next integration step.
