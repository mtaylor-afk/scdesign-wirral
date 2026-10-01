-- WV Roofing schema 0009: which site a photo came from, and the previews made on
-- the customer's own device.

-- 'v1' is the Roof Visualiser (/WVROOFING/visualiser/), 'v2' the Roof Cam
-- (/WVROOFING/2/roof-cam/). Both keep their photos in the same private store, and
-- the operator screen shows them side by side.
ALTER TABLE wvr_projects ADD COLUMN IF NOT EXISTS site text NOT NULL DEFAULT 'v1';
CREATE INDEX IF NOT EXISTS wvr_projects_created_idx ON wvr_projects (created_at);

-- A preview the customer's device drew (the Roof Cam's roofs, the visualiser's
-- quick previews), sent with their enquiry so the roofer sees the roof they
-- chose. The JPEG is in private storage under projects/<id>/mockups/ and goes
-- with the project. condition is the Roof Cam's weather (null for version 1).
CREATE TABLE IF NOT EXISTS wvr_mockups (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES wvr_projects (id) ON DELETE CASCADE,
  photo_id uuid REFERENCES wvr_photos (id) ON DELETE SET NULL,
  visual_id text NOT NULL,
  condition text,
  pathname text NOT NULL,
  bytes integer NOT NULL,
  w integer NOT NULL,
  h integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wvr_mockups_project_idx ON wvr_mockups (project_id, created_at);
