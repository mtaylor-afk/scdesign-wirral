-- ============================================================
-- SC Design Wirral — projects CMS tables
-- ============================================================
-- Run ONCE in the `sc-analytics` Supabase project's SQL editor
-- (project ref: yxapzkiodjecladjziom). The schema lives in Supabase,
-- not in this repo — this file is kept only as the canonical record,
-- exactly like db/sc_errors.sql.
--
-- Backs the admin portal's Content → Projects section, where Sean writes
-- and publishes case studies himself. Written and read by the serverless
-- functions api/sc-admin-projects.js and api/sc-admin-publish.js using the
-- service-role key (which bypasses RLS); nothing here is ever reachable
-- from the public site.
--
-- IMPORTANT — this is the EDITING store, not what the website reads.
-- Publishing commits content/projects/<slug>.json and the images into the
-- git repo, and the static build reads those. So these tables are Sean's
-- workbench: drafts, edit history and the audit trail. The live site never
-- queries Supabase for project content, which is what keeps every case
-- study prerendered and indexable.
-- ============================================================

-- ------------------------------------------------------------
-- One row per case study.
-- ------------------------------------------------------------
create table if not exists public.sc_projects (
  -- The URL slug, and the filename it publishes to. Primary key because a
  -- slug must be unique across the whole site.
  slug             text primary key,

  -- draft | published. A draft has no effect on the live site at all: it is
  -- not committed, so it is not built, not in the sitemap and not linked.
  status           text not null default 'draft',

  -- The full project object as the admin saved it, validated against the
  -- schema in serverlib/cms.js. Stored whole rather than split into columns
  -- so the shape can evolve with the Project type without a migration; the
  -- authority on its shape is serverlib/cms.js, re-checked at build time.
  content          jsonb not null,

  -- Sean's running order on /projects. Lower sorts first; nulls last.
  sort_order       integer,

  -- Set when the project last reached the live site, with the commit that
  -- did it, so the admin can show "live as of ..." and link the change.
  published_at     timestamptz,
  last_publish_sha text,

  -- Which admin user saved it (from the session, not client-supplied).
  updated_by       text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists sc_projects_status_idx
  on public.sc_projects (status);
create index if not exists sc_projects_order_idx
  on public.sc_projects (sort_order nulls last, updated_at desc);

-- Keep updated_at honest without relying on the API to remember.
create or replace function public.sc_projects_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sc_projects_touch on public.sc_projects;
create trigger sc_projects_touch
  before update on public.sc_projects
  for each row execute function public.sc_projects_touch();

-- No policies: the API uses the service-role key (bypasses RLS); anon/public
-- is blocked. Same stance as sc_errors and sc_enquiries.
alter table public.sc_projects enable row level security;


-- ------------------------------------------------------------
-- Audit trail. Publishing and deleting both change the live website, so
-- every attempt is recorded whether it succeeded or not — this is the log
-- you read when a page appears, disappears or fails to publish.
-- ------------------------------------------------------------
create table if not exists public.sc_project_events (
  id         bigint generated always as identity primary key,
  ts         timestamptz not null default now(),
  slug       text,
  -- save | publish | unpublish | delete | restore
  action     text not null,
  -- ok | refused | error
  outcome    text not null,
  -- Why it was refused (a failed content rule) or how it broke.
  detail     text,
  -- The commit this action produced, when it produced one.
  commit_sha text,
  -- Admin username from the verified session — never client-supplied.
  actor      text,
  -- Cookieless hash, consistent with the rest of the stack: never a raw IP.
  ip_hash    text,
  created_at timestamptz not null default now()
);

create index if not exists sc_project_events_ts_idx
  on public.sc_project_events (ts desc);
create index if not exists sc_project_events_slug_idx
  on public.sc_project_events (slug, ts desc);

alter table public.sc_project_events enable row level security;


-- ------------------------------------------------------------
-- Storage bucket for uploaded project photos.
-- ------------------------------------------------------------
-- PRIVATE on purpose. Images are staged here while Sean works, then copied
-- into the repo at publish time and served from Cloudflare — so the bucket
-- is a workbench, not a CDN, and nothing unpublished is ever publicly
-- reachable. The admin previews them through short-lived signed URLs, the
-- same pattern as the visualiser bucket in supabase/migrations/0002_storage.sql.
insert into storage.buckets (id, name, public)
values ('project-media', 'project-media', false)
on conflict (id) do nothing;

-- (No storage.objects policies — access is service-role only.)

-- OPTIONAL housekeeping: staged images for projects that no longer exist.
-- Publishing copies images into the repo, so the staged copy is disposable.
--   delete from storage.objects
--   where bucket_id = 'project-media'
--     and split_part(name, '/', 1) not in (select slug from public.sc_projects);
