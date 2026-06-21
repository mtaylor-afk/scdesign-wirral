-- ============================================================
-- SC Design Wirral — error log table
-- ============================================================
-- Run ONCE in the `sc-analytics` Supabase project's SQL editor
-- (project ref: yxapzkiodjecladjziom). The schema lives in Supabase,
-- not in this repo — this file is kept only as the canonical record.
--
-- Stores every client-side error captured by the site's error tracker
-- (src/components/ErrorTracking.tsx) and the admin portal's
-- error-capture.js. Written by the public ingest endpoint
-- api/sc-error-collect.js using the service-role key (which bypasses
-- RLS); the admin read endpoint api/sc-admin-error-logs.js reads it.
-- Cookieless: a daily-rotating visitor hash, never a raw IP.
-- ============================================================

create table if not exists public.sc_errors (
  id            bigint generated always as identity primary key,
  ts            timestamptz not null default now(),
  type          text,            -- js_error | resource_error | unhandled_rejection
                                  -- | react_error | form_error | console_error
  severity      text,            -- error | warning
  message       text,
  source        text,            -- script / resource URL the error came from
  lineno        integer,
  colno         integer,
  stack         text,
  path          text,            -- pathname
  url           text,            -- full href
  referrer_host text,
  vid           text,            -- cookieless daily visitor hash (no IP stored)
  browser       text,
  bv            text,
  os            text,
  osv           text,
  device        text,
  is_bot        boolean default false,
  country       text,
  region        text,
  city          text,
  lang          text,
  tz            text,
  viewport      text,            -- "1440x900"
  screen        text,            -- "1920x1080"
  surface       text,            -- public | admin
  props         jsonb,           -- raw UA, breadcrumbs[], utm, connection, per-type extras
  created_at    timestamptz not null default now()
);

create index if not exists sc_errors_ts_idx    on public.sc_errors (ts desc);
create index if not exists sc_errors_isbot_idx on public.sc_errors (is_bot);

-- No policies: the API uses the service-role key (bypasses RLS); anon/public is blocked.
alter table public.sc_errors enable row level security;
