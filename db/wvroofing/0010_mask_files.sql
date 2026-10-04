-- WV Roofing 0010: roof outlines (mask PNGs) are kept as files in storage, not in the database.
-- In snapshot mode (db.js) every row is saved as one object, so an outline of up to
-- 512 KB per row could grow it past the store's size limit (review, 2026-10-04).
-- New outlines have png_path set and png NULL; older rows keep their bytes.
ALTER TABLE wvr_masks ADD COLUMN IF NOT EXISTS png_path text;
ALTER TABLE wvr_masks ALTER COLUMN png DROP NOT NULL;
