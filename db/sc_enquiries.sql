-- ============================================================
-- SC Design Wirral — enquiry backup table
-- ============================================================
-- Run ONCE in the `sc-analytics` Supabase project's SQL editor
-- (project ref: yxapzkiodjecladjziom). The schema lives in Supabase,
-- not in this repo — this file is kept only as the canonical record.
--
-- Stores a durable copy of every website form submission (contact form +
-- visualiser "send this concept" handoff). Written by the public ingest
-- endpoint api/sc-enquiry-backup.js using the service-role key (which
-- bypasses RLS); the admin read endpoint api/sc-admin-enquiries.js reads it.
-- No raw IP is stored — coarse geo only, consistent with the analytics stack.
--
-- IMPORTANT: the ingest endpoint inserts an EXACT set of named columns (below).
-- PostgREST rejects an insert that references a column the table lacks, and the
-- enquiry insert has no self-healing retry (unlike sc_errors), so this table
-- must contain every column listed here or storage will fail (stored:false).
-- ============================================================

create table if not exists public.sc_enquiries (
  id                bigint generated always as identity primary key,
  created_at        timestamptz not null default now(),

  form              text,          -- contact | visualiser_concept | cost_estimate
  name              text,
  email             text,
  phone             text,
  postcode          text,
  area              text,
  project_type      text,
  project_stage     text,
  has_builder       text,
  timescale         text,
  budget            text,
  preferred_contact text,
  message           text,

  page              text,          -- full href the form was submitted from
  referrer_host     text,
  channel           text,          -- direct | search | social | referral | paid | email

  country           text,          -- coarse geo (Vercel edge headers; IP not stored)
  region            text,
  city              text,

  device            text,          -- desktop | tablet | mobile
  browser           text,
  os                text,

  status            text default 'new',  -- new | (future: contacted | closed …)

  fields            jsonb,         -- complete, bounded copy of every submitted field
  meta              jsonb          -- page, ref, utm, lang, tz, userAgent, bot flag
);

create index if not exists sc_enquiries_created_idx on public.sc_enquiries (created_at desc);
create index if not exists sc_enquiries_status_idx  on public.sc_enquiries (status);
create index if not exists sc_enquiries_form_idx    on public.sc_enquiries (form);

-- No policies: the API uses the service-role key (bypasses RLS); anon/public is blocked.
alter table public.sc_enquiries enable row level security;
