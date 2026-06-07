-- ============================================================
-- Private storage bucket for watermarked visualiser results.
-- No RLS policies → only the service-role key (used by the Vercel API) can
-- read/write. Results are served to users via short-lived signed URLs.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('visualiser-results', 'visualiser-results', false)
on conflict (id) do nothing;

-- (No storage.objects policies are created — access is service-role only.)

-- OPTIONAL retention helper (run via pg_cron if desired):
--   delete from storage.objects
--   where bucket_id = 'visualiser-results'
--     and created_at < now() - interval '7 days';
-- and the matching metadata rows:
--   delete from public.visualiser_jobs where expires_at < now();
