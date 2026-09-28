-- WV Roofing schema 0008 (B3): plans, drawings and extra photos a customer adds
-- so the roofer can measure the roof from them.
--
-- The files are in private storage under projects/<id>/evidence/ and go with the
-- project (30 days, or 12 months with an enquiry). The file's own name isn't
-- kept (it can hold personal details). Photos have their hidden details removed
-- like the main photo; PDFs are kept as uploaded.
CREATE TABLE IF NOT EXISTS wvr_evidence (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES wvr_projects (id) ON DELETE CASCADE,
  -- image | pdf
  kind text NOT NULL,
  mime text NOT NULL,
  bytes integer NOT NULL,
  sha256 text NOT NULL,
  pathname text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wvr_evidence_project_idx ON wvr_evidence (project_id, created_at);
