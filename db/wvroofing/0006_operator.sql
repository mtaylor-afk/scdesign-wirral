-- WV Roofing schema 0006 (A6): the operator screen's sessions, login attempts and audit trail.

-- Operator sessions: a 256-bit random key (only its SHA-256 hash is stored), valid
-- for 12 hours, revoked by logging out. The browser keeps the key in sessionStorage.
-- hash_tag identifies the password hash the session was opened under, so setting a
-- new password ends every session. Deleted 7 days after they end.
CREATE TABLE IF NOT EXISTS wvr_operator_sessions (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  hash_tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip_hash text,
  ua_family text
);

-- Every login attempt, for lockouts (5 failures from one visitor, or 20 in all,
-- within 15 minutes). Deleted after 7 days.
CREATE TABLE IF NOT EXISTS wvr_login_attempts (
  id bigserial PRIMARY KEY,
  ip_hash text,
  ok boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wvr_login_attempts_created_idx ON wvr_login_attempts (created_at);

-- What the operator did, with the state before and after. Never edited; deleted
-- after 12 months by the daily sweep (like enquiries).
CREATE TABLE IF NOT EXISTS wvr_operator_actions (
  id bigserial PRIMARY KEY,
  operator text NOT NULL DEFAULT 'owner',
  session_id uuid,
  target_type text NOT NULL,
  target_id text NOT NULL,
  action text NOT NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wvr_operator_actions_target_idx ON wvr_operator_actions (target_type, target_id, created_at);

ALTER TABLE wvr_enquiries ADD COLUMN IF NOT EXISTS survey_requested_at timestamptz;
