-- WV Roofing schema 0005 (A5): the customer's address and property confirmation.

-- Only the address the customer chose is stored (never a whole lookup response:
-- Royal Mail's terms don't allow caching it). A new address supersedes the old one.
CREATE TABLE IF NOT EXISTS wvr_addresses (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES wvr_projects (id) ON DELETE CASCADE,
  -- ideal_postcodes | manual | fixture (test environment only)
  provider text NOT NULL,
  postcode text,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  post_town text,
  uprn text,
  udprn text,
  umprn text,
  lat double precision,
  lng double precision,
  -- rooftop (from the UPRN) | postcode_centroid | none
  coord_source text NOT NULL DEFAULT 'none',
  -- paf | mr | nyb (not yet built) | abp
  dataset text,
  fetched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz
);
CREATE INDEX IF NOT EXISTS wvr_addresses_project_idx ON wvr_addresses (project_id, created_at);

-- What the customer confirmed about the property on the aerial view. Never edited:
-- a change (by the customer, or later by the operator) is a new row.
CREATE TABLE IF NOT EXISTS wvr_property_confirmations (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES wvr_projects (id) ON DELETE CASCADE,
  address_id uuid REFERENCES wvr_addresses (id) ON DELETE CASCADE,
  -- google_static_maps | fixture | NULL (no aerial image was shown)
  imagery_provider text,
  pin_shown boolean NOT NULL DEFAULT false,
  pin_confirmed boolean NOT NULL DEFAULT false,
  -- detached | semi | end_terrace | mid_terrace | bungalow | flat | other | not_sure
  property_type text NOT NULL,
  included_structures jsonb NOT NULL DEFAULT '{}'::jsonb,
  ambiguous boolean NOT NULL DEFAULT false,
  ambiguity_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  confirmed_by text NOT NULL DEFAULT 'customer',
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz
);
CREATE INDEX IF NOT EXISTS wvr_property_confirmations_project_idx ON wvr_property_confirmations (project_id, confirmed_at);

ALTER TABLE wvr_projects ADD COLUMN IF NOT EXISTS address_id uuid;
ALTER TABLE wvr_projects ADD COLUMN IF NOT EXISTS property_confirmation_id uuid;
