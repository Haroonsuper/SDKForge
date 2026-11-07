-- =====================================================================================
-- SDKForge - multi-tenant schema for Supabase / PostgreSQL 15+
--   Tenancy model:  auth.users -> profiles
--                   organizations (tenant)  -> organization_members (roles)
--                   organizations -> workspaces -> projects -> sdk_builds
--   Every tenant row carries org_id and is protected by Row Level Security (auth.uid()).
--   Billing columns (plan_tier, monthly_quota, subscription_status, stripe ids) can only be
--   written by the service role (Stripe webhook), never by a logged-in user.
-- Run in the Supabase SQL editor or via `supabase db push`.
-- =====================================================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------------------------
-- 1. Enumerated types
-- -------------------------------------------------------------------------------------
do $$ begin
  create type public.plan_tier           as enum ('starter', 'growth_pro', 'enterprise_scale');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.subscription_status as enum ('active', 'trialing', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.member_role         as enum ('owner', 'admin', 'developer', 'viewer');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.spec_type           as enum ('openapi_v3', 'swagger_v2', 'postman_v2');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.sdk_language        as enum ('typescript', 'python', 'go');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.build_status        as enum ('building', 'completed', 'failed');
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------------------------------
-- 2. Plans catalogue (Starter free/20 builds, Growth Pro $49/500, Enterprise Scale $249/unlimited)
--    monthly_quota NULL = unlimited. stripe_price_id is filled in after creating prices in Stripe.
-- -------------------------------------------------------------------------------------
create table if not exists public.plans (
  tier            public.plan_tier primary key,
  display_name    text    not null,
  price_usd_cents integer not null check (price_usd_cents >= 0),
  monthly_quota   integer check (monthly_quota is null or monthly_quota > 0),
  stripe_price_id text unique
);

insert into public.plans (tier, display_name, price_usd_cents, monthly_quota) values
  ('starter',          'Starter',          0,     20),
  ('growth_pro',       'Growth Pro',       4900,  500),
  ('enterprise_scale', 'Enterprise Scale', 24900, null)
on conflict (tier) do update
  set display_name = excluded.display_name,
      price_usd_cents = excluded.price_usd_cents,
      monthly_quota = excluded.monthly_quota;

-- -------------------------------------------------------------------------------------
-- 3. Helpers
-- -------------------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.safe_uuid(p_text text)
returns uuid language plpgsql immutable as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end $$;

-- -------------------------------------------------------------------------------------
-- 4. Profiles (the "users data table"): one row per auth user, holds billing state
-- -------------------------------------------------------------------------------------
create table if not exists public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  email                   text,
  full_name               text,
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  plan_tier               public.plan_tier           not null default 'starter',
  monthly_quota           integer check (monthly_quota is null or monthly_quota > 0) default 20,
  subscription_status     public.subscription_status not null default 'active',
  current_period_end      timestamptz,
  used_quota_this_month   integer     not null default 0 check (used_quota_this_month >= 0),
  quota_period_start      timestamptz not null default date_trunc('month', now()),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------------------
-- 5. Tenancy tables
-- -------------------------------------------------------------------------------------
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  owner_id    uuid not null references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists organizations_owner_idx on public.organizations (owner_id);
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

create table if not exists public.organization_members (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.member_role not null default 'developer',
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists organization_members_user_idx on public.organization_members (user_id);

create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, org_id),
  unique (org_id, name)
);
create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();

create table if not exists public.projects (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null,
  workspace_id        uuid not null,
  name                text not null check (char_length(name) between 1 and 120),
  description         text not null default '' check (char_length(description) <= 1000),
  spec_type           public.spec_type not null,
  spec_version        text not null default '1.0.0',
  spec_raw            text not null check (char_length(spec_raw) <= 5242880),  -- 5 MB, same limit as the engine
  endpoint_count      integer not null default 0 check (endpoint_count >= 0),
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, org_id),
  unique (workspace_id, name),
  -- guarantees the workspace really belongs to the same organization
  foreign key (workspace_id, org_id) references public.workspaces (id, org_id) on delete cascade
);
create index if not exists projects_org_idx on public.projects (org_id);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create table if not exists public.sdk_builds (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null,
  project_id              uuid not null,
  language                public.sdk_language not null,
  version                 text not null,
  status                  public.build_status not null default 'building',
  commit_hash             text not null unique check (commit_hash ~ '^[0-9a-f]{7,40}$'),
  zip_size_kb             numeric(12, 1) not null default 0 check (zip_size_kb >= 0),
  generated_files_count   integer not null default 0 check (generated_files_count >= 0),
  duration_ms             integer not null default 0 check (duration_ms >= 0),
  storage_path            text,                       -- e.g. <org_id>/<project_id>/<build_id>.zip
  logs                    jsonb not null default '[]'::jsonb,
  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade
);
create index if not exists sdk_builds_project_idx on public.sdk_builds (project_id, created_at desc);
create index if not exists sdk_builds_org_idx on public.sdk_builds (org_id, created_at desc);

-- Stripe webhook idempotency log (service role only; RLS on, no policies)
create table if not exists public.stripe_events (
  id            text primary key,              -- Stripe event id (evt_...)
  type          text not null,
  processed_at  timestamptz not null default now()
);

-- -------------------------------------------------------------------------------------
-- 6. Authorization helper functions (SECURITY DEFINER avoids RLS recursion on members table)
-- -------------------------------------------------------------------------------------
create or replace function public.org_role_of(p_org uuid)
returns public.member_role language sql stable security definer set search_path = public as $$
  select m.role from public.organization_members m
  where m.org_id = p_org and m.user_id = auth.uid();
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_write_org(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.org_role_of(p_org) in ('owner', 'admin', 'developer'), false);
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.org_role_of(p_org) in ('owner', 'admin'), false);
$$;

revoke all on function public.org_role_of(uuid), public.is_org_member(uuid),
                        public.can_write_org(uuid), public.is_org_admin(uuid) from public, anon;
grant execute on function public.org_role_of(uuid), public.is_org_member(uuid),
                          public.can_write_org(uuid), public.is_org_admin(uuid) to authenticated;

-- -------------------------------------------------------------------------------------
-- 7. Triggers: onboarding, owner membership, build quota
-- -------------------------------------------------------------------------------------

-- New auth user -> profile + personal organization + default workspace
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.organizations (name, owner_id)
  values (coalesce(nullif(split_part(new.email, '@', 1), ''), 'My') || '''s Organization', new.id)
  returning id into v_org;

  insert into public.workspaces (org_id, name) values (v_org, 'Default Workspace');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Organization creator becomes owner member automatically
create or replace function public.handle_new_organization()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.organization_members (org_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_organization_created on public.organizations;
create trigger on_organization_created after insert on public.organizations
  for each row execute function public.handle_new_organization();

-- Build quota: counted against the organization owner's plan, resets every calendar month
create or replace function public.enforce_build_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner   uuid;
  v_profile public.profiles%rowtype;
  v_month   timestamptz := date_trunc('month', now());
begin
  select owner_id into v_owner from public.organizations where id = new.org_id;
  if v_owner is null then
    raise exception 'organization % not found', new.org_id using errcode = 'foreign_key_violation';
  end if;

  select * into v_profile from public.profiles where id = v_owner for update;

  if v_profile.quota_period_start < v_month then
    update public.profiles set used_quota_this_month = 0, quota_period_start = v_month where id = v_owner;
    v_profile.used_quota_this_month := 0;
  end if;

  if v_profile.plan_tier <> 'starter'
     and v_profile.subscription_status in ('past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused') then
    raise exception 'Subscription is not active. Please update your billing details.' using errcode = 'P0001';
  end if;

  if v_profile.monthly_quota is not null and v_profile.used_quota_this_month >= v_profile.monthly_quota then
    raise exception 'Monthly build quota of % reached for the % plan.', v_profile.monthly_quota, v_profile.plan_tier
      using errcode = 'P0001';
  end if;

  update public.profiles set used_quota_this_month = used_quota_this_month + 1 where id = v_owner;
  return new;
end $$;

drop trigger if exists sdk_builds_quota on public.sdk_builds;
create trigger sdk_builds_quota before insert on public.sdk_builds
  for each row execute function public.enforce_build_quota();

-- Optional: call monthly from pg_cron  ->  select cron.schedule('reset-quota', '0 0 1 * *', 'select public.reset_monthly_usage()');
create or replace function public.reset_monthly_usage()
returns void language sql security definer set search_path = public as $$
  update public.profiles
     set used_quota_this_month = 0, quota_period_start = date_trunc('month', now())
   where quota_period_start < date_trunc('month', now());
$$;
revoke all on function public.reset_monthly_usage() from public, anon, authenticated;

-- -------------------------------------------------------------------------------------
-- 8. Row Level Security
-- -------------------------------------------------------------------------------------
alter table public.plans                 enable row level security;
alter table public.profiles              enable row level security;
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.workspaces            enable row level security;
alter table public.projects              enable row level security;
alter table public.sdk_builds            enable row level security;
alter table public.stripe_events         enable row level security;   -- no policies: service role only

-- plans: public catalogue
create policy plans_read on public.plans for select to anon, authenticated using (true);

-- profiles: a user sees and edits only their own row, and only non-billing columns
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant  update (full_name) on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated, anon;

-- organizations
create policy orgs_select on public.organizations for select to authenticated
  using (public.is_org_member(id) or owner_id = auth.uid());   -- owner clause makes INSERT ... RETURNING work
create policy orgs_insert on public.organizations for insert to authenticated
  with check (owner_id = auth.uid());
create policy orgs_update on public.organizations for update to authenticated
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));
revoke update on public.organizations from authenticated, anon;
grant  update (name) on public.organizations to authenticated;   -- ownership can never be reassigned by clients
create policy orgs_delete on public.organizations for delete to authenticated
  using (owner_id = auth.uid());

-- members: members can list teammates; only admins manage; owner row can never be removed/changed here
create policy members_select on public.organization_members for select to authenticated
  using (public.is_org_member(org_id));
create policy members_insert on public.organization_members for insert to authenticated
  with check (public.is_org_admin(org_id) and role <> 'owner');
create policy members_update on public.organization_members for update to authenticated
  using (public.is_org_admin(org_id) and role <> 'owner')
  with check (public.is_org_admin(org_id) and role <> 'owner');
create policy members_delete on public.organization_members for delete to authenticated
  using (public.is_org_admin(org_id) and role <> 'owner');

-- workspaces
create policy workspaces_select on public.workspaces for select to authenticated using (public.is_org_member(org_id));
create policy workspaces_insert on public.workspaces for insert to authenticated with check (public.can_write_org(org_id));
create policy workspaces_update on public.workspaces for update to authenticated
  using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));
create policy workspaces_delete on public.workspaces for delete to authenticated using (public.is_org_admin(org_id));

-- projects
create policy projects_select on public.projects for select to authenticated using (public.is_org_member(org_id));
create policy projects_insert on public.projects for insert to authenticated
  with check (public.can_write_org(org_id) and created_by = auth.uid());
create policy projects_update on public.projects for update to authenticated
  using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));
create policy projects_delete on public.projects for delete to authenticated using (public.is_org_admin(org_id));

-- sdk_builds: immutable history (select + insert only)
create policy builds_select on public.sdk_builds for select to authenticated using (public.is_org_member(org_id));
create policy builds_insert on public.sdk_builds for insert to authenticated
  with check (public.can_write_org(org_id) and created_by = auth.uid());

-- -------------------------------------------------------------------------------------
-- 9. Storage bucket for generated ZIP artifacts: path must start with "<org_id>/"
-- -------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('sdk-artifacts', 'sdk-artifacts', false, 52428800)
on conflict (id) do nothing;

create policy sdk_artifacts_read on storage.objects for select to authenticated
  using (bucket_id = 'sdk-artifacts' and public.is_org_member(public.safe_uuid((storage.foldername(name))[1])));
create policy sdk_artifacts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sdk-artifacts' and public.can_write_org(public.safe_uuid((storage.foldername(name))[1])));
create policy sdk_artifacts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sdk-artifacts' and public.is_org_admin(public.safe_uuid((storage.foldername(name))[1])));
