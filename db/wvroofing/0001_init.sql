-- WV Roofing schema 0001 (A1): operational tables.
-- Applied automatically by serverlib/wvroofing/db.js (one transaction, advisory-locked).
-- Everything WV Roofing stores lives in tables prefixed wvr_ in its own database;
-- nothing here is shared with SC Design.

-- Fixed-window rate limits shared by every function instance.
-- key is a keyed hash (never a raw IP address); rows older than 48 hours are purged daily.
CREATE TABLE IF NOT EXISTS wvr_rate_limits (
  scope text NOT NULL,
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, key, window_start)
);
CREATE INDEX IF NOT EXISTS wvr_rate_limits_window_idx ON wvr_rate_limits (window_start);

-- Named, time-limited leases (e.g. "only one daily sweep at a time").
CREATE TABLE IF NOT EXISTS wvr_leases (
  name text PRIMARY KEY,
  holder text NOT NULL,
  until timestamptz NOT NULL
);

-- One row per scheduled sweep / retention run, for the operator and the handover.
CREATE TABLE IF NOT EXISTS wvr_retention_runs (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
