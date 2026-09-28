-- WV Roofing schema 0004 (A4): enquiries, stored before anyone is notified.

-- One row per enquiry. It is saved first; the email to the roofer is a separate,
-- retried step (delivery_status), so a failed email never loses an enquiry.
-- reference (WVR-YYMM-XXXX) is shown to the customer and used in emails; it is
-- never used to look anything up for a customer.
CREATE TABLE IF NOT EXISTS wvr_enquiries (
  id uuid PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  -- NULL for the roof-replacement form, and once the customer deletes their project
  project_id uuid REFERENCES wvr_projects (id) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  source text NOT NULL,
  contact_name text NOT NULL,
  contact_email text,
  contact_phone text,
  postcode text,
  visual_id text,
  notes text,
  include_images boolean NOT NULL DEFAULT false,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  lawful_basis text NOT NULL DEFAULT 'steps_before_contract',
  -- what the project looked like when the enquiry was sent (ids and versions, no images)
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- new | spam_suspected (kept, never emailed)
  status text NOT NULL DEFAULT 'new',
  -- pending | sending | sent | failed | uncertain
  delivery_status text NOT NULL DEFAULT 'pending',
  delivery_attempts integer NOT NULL DEFAULT 0,
  delivery_lease_until timestamptz,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  delivery_error text,
  message_id text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- One enquiry per project; a repeated tap (or a reload and a tap) returns it.
CREATE UNIQUE INDEX IF NOT EXISTS wvr_enquiries_one_per_project ON wvr_enquiries (project_id) WHERE project_id IS NOT NULL;
-- Forms without a project: the same request key always means the same enquiry.
CREATE UNIQUE INDEX IF NOT EXISTS wvr_enquiries_free_key ON wvr_enquiries (idempotency_key) WHERE project_id IS NULL;
CREATE INDEX IF NOT EXISTS wvr_enquiries_delivery_idx ON wvr_enquiries (delivery_status, next_attempt_at);
CREATE INDEX IF NOT EXISTS wvr_enquiries_created_idx ON wvr_enquiries (created_at);
