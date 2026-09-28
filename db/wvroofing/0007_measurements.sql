-- WV Roofing schema 0007 (B2): roof measurements.
--
-- One row per measurement of a project's roof. Never edited in place: a
-- correction is a new row, and the old one is marked superseded_by the new one.
-- A new address supersedes the project's measurements. The customer sees a
-- measurement only when the operator has approved it AND made it visible (with
-- the display rights recorded).
CREATE TABLE IF NOT EXISTS wvr_measurements (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES wvr_projects (id) ON DELETE CASCADE,
  -- the property confirmation (and so the address and scope) it measures
  property_confirmation_id uuid,
  -- operator_manual | customer_evidence | hover | desk_measure | an automatic provider
  source text NOT NULL,
  -- site_survey | drawings | customer_evidence | hover_report | desk_estimate
  method text NOT NULL,
  -- indicative_available | processing | needs_review | unavailable | awaiting_survey
  status text NOT NULL,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ id, plan_area_m2, pitch_deg, surface_area_m2, slope_adjusted_by_source, azimuth_deg, included, flags }]
  -- full precision; surface_area_m2 is worked out from plan area and pitch only when the source didn't give it
  faces jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ id, kind, length_m, face_ids, source }]: entered, never worked out from areas
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  gross_surface_m2 double precision,
  -- anything added or taken away, kept apart from the gross figure (none yet)
  adjustments jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- the date of the oldest source used (a survey's date, a report's date)
  source_date date,
  source_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by text,
  approved_at timestamptz,
  rejected_at timestamptz,
  customer_visible boolean NOT NULL DEFAULT false,
  display_rights_ref text,
  superseded_by uuid,
  superseded_at timestamptz
);
CREATE INDEX IF NOT EXISTS wvr_measurements_project_idx ON wvr_measurements (project_id, created_at);
