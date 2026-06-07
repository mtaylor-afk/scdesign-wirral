-- ============================================================
-- SC Design & Construction — initial schema
-- Tables: leads, visualiser_jobs, visualiser_leads, visualiser_rate_limits
-- All access is via the Vercel API routes using the SERVICE ROLE key.
-- RLS is ENABLED with NO policies (default deny) — the anon key cannot read or
-- write these tables directly.
-- ============================================================

-- Contact-form leads ------------------------------------------------
create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null,
  phone        text,
  postcode     text,
  project_type text,
  message      text,
  consent      boolean not null default false,
  source_page  text,
  ip           text,
  created_at   timestamptz not null default now()
);

-- Visualiser job records (metadata only — never the source image) --
create table if not exists public.visualiser_jobs (
  id           uuid primary key,
  ip           text,
  project_type text,
  storeys      text,
  style        text,
  mocked       boolean not null default false,
  storage_path text,
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- Leads captured from "send this concept to Sean" -----------------
create table if not exists public.visualiser_leads (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  contact    text not null,
  postcode   text,
  notes      text,
  result_id  text,
  result_url text,
  ip         text,
  created_at timestamptz not null default now()
);

-- Shared-store rate limiting for the visualiser -------------------
create table if not exists public.visualiser_rate_limits (
  id         bigserial primary key,
  ip         text not null,
  day        date not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_visualiser_rl_day_ip on public.visualiser_rate_limits (day, ip);

-- Enable RLS (default deny — service role bypasses RLS) -----------
alter table public.leads                  enable row level security;
alter table public.visualiser_jobs        enable row level security;
alter table public.visualiser_leads       enable row level security;
alter table public.visualiser_rate_limits enable row level security;
