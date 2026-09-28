-- WV Roofing schema 0003 (A3): durable render jobs, the daily budget ledger and the
-- log of paid provider calls.

-- One row per photo-real render. The POST that creates it answers 202 straight away;
-- the work continues in the background (waitUntil), customer polls reconcile it, and
-- the daily cron sweeps anything left. A job that reached OpenAI and then lost track
-- of the answer is 'uncertain': it may have been charged, so it is never repeated
-- automatically ("Try again" creates a new job).
CREATE TABLE IF NOT EXISTS wvr_jobs (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES wvr_projects (id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'render',
  -- what was asked for (the versions it was computed from)
  photo_id uuid NOT NULL,
  mask_id uuid NOT NULL,
  visual_id text NOT NULL,
  catalogue_version integer,
  prompt_version text NOT NULL,
  model text NOT NULL,
  quality text NOT NULL,
  size text,
  spec jsonb,
  -- queued | running | succeeded | failed | cancelled | uncertain | superseded
  status text NOT NULL DEFAULT 'queued',
  quarantined boolean NOT NULL DEFAULT false,
  attempt integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 2,
  requeues integer NOT NULL DEFAULT 0,
  lease_token text,
  lease_until timestamptz,
  run_after timestamptz,
  called_at timestamptz,
  idempotency_key text NOT NULL,
  error_code text,
  error_detail text,
  -- cost: reserved against the day's budget when queued, settled from OpenAI's usage.
  -- budget_day is the UTC day as text ('YYYY-MM-DD'), so no database driver turns it
  -- into a local-time Date and settles the wrong day.
  budget_day text,
  cost_reserved_usd numeric(10, 4) NOT NULL DEFAULT 0,
  cost_settled_usd numeric(10, 4),
  usage jsonb,
  request_id text,
  -- results (private storage) and the compositing checks
  raw_path text,
  composite_path text,
  qa jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS wvr_jobs_project_idx ON wvr_jobs (project_id, created_at);
CREATE INDEX IF NOT EXISTS wvr_jobs_open_idx ON wvr_jobs (status, run_after) WHERE status IN ('queued', 'running');

-- Daily spend ceiling (UTC days). reserved_usd = renders in flight (or uncertain),
-- spent_usd = settled from usage. A reservation is refused if it would take
-- reserved + spent past WVR_DAILY_BUDGET_USD.
CREATE TABLE IF NOT EXISTS wvr_budget_days (
  day date PRIMARY KEY,
  reserved_usd numeric(10, 4) NOT NULL DEFAULT 0,
  spent_usd numeric(10, 4) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Every paid call to an outside provider, for costs and the operator. Kept when a
-- project is deleted (project_id is cleared): it holds no personal data.
CREATE TABLE IF NOT EXISTS wvr_provider_calls (
  id bigserial PRIMARY KEY,
  provider text NOT NULL,
  endpoint text NOT NULL,
  project_id uuid REFERENCES wvr_projects (id) ON DELETE SET NULL,
  job_id uuid,
  model text,
  status text NOT NULL,
  http_status integer,
  duration_ms integer,
  cost_usd numeric(10, 4),
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wvr_provider_calls_created_idx ON wvr_provider_calls (created_at);
