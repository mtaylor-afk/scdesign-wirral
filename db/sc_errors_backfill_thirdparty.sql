-- ============================================================
-- SC Design Wirral — one-off backfill: flag existing browser-extension errors
-- ============================================================
-- OPTIONAL. Nothing is broken if this is never run.
--
-- The admin now also applies the same extension test in the browser, to
-- whatever the server returns — so the four untagged historical rows are
-- already hidden from the default view and excluded from the download, and the
-- export states how many it left out. Running this simply moves that work back
-- to the database, which makes the on-screen COUNTS exact as well (the server
-- can only filter on the flag, so today the total still includes them).
--
-- Run ONCE in the `sc-analytics` Supabase project's SQL editor
-- (project ref: yxapzkiodjecladjziom), alongside db/sc_errors.sql.
--
-- WHY
-- Browser-extension code runs inside the page, so when it throws, the error
-- reaches sc_errors looking exactly like one of ours. From Sept 2026 the
-- reporter tags these at capture time (src/lib/error-report.ts sets
-- props.thirdParty), and the admin hides them behind the "Our website" filter.
--
-- But that flag only exists on rows captured AFTER that change shipped. Rows
-- already in the table have no flag, so they still count as the website's own
-- errors — verified live: 22 total, 22 under "Our website", 0 under
-- "Extensions only", even though four of them are demonstrably extension
-- faults. This statement backfills those four.
--
-- WHAT IT MATCHES
-- Only an explicit extension URL scheme in the stack or source —
-- chrome-extension://, moz-extension://, safari-web-extension:// and so on.
-- That is the same narrow test the reporter uses, and deliberately so: a
-- broader pattern risks flagging a genuine fault, which would then be hidden
-- from the default admin view and never fixed. Leaving a little noise is the
-- safer error.
--
-- Nothing is deleted. The rows stay, fully intact, and remain visible under
-- the "Include extensions" and "Extensions only" filters.
-- ============================================================

-- Have a look before changing anything — this should list only errors whose
-- stack or source points at a browser extension.
select id, ts, type, left(message, 80) as message, left(coalesce(stack, source), 120) as origin
from public.sc_errors
where stack like '%-extension://%'
   or source like '%-extension://%'
order by ts desc;

-- Then apply. `||` merges into the existing props object, so every other key
-- (breadcrumbs, connection, surface, …) is preserved.
update public.sc_errors
set props = coalesce(props, '{}'::jsonb) || '{"thirdParty": true}'::jsonb
where (stack like '%-extension://%' or source like '%-extension://%')
  and coalesce(props ->> 'thirdParty', '') <> 'true';

-- Confirm: the first number should now be non-zero and the second should have
-- dropped by the same amount.
select
  count(*) filter (where props ->> 'thirdParty' = 'true') as extension_errors,
  count(*) filter (where props ->> 'thirdParty' is null)  as our_errors,
  count(*)                                                as total
from public.sc_errors;

-- ------------------------------------------------------------
-- NOT covered, on purpose
-- ------------------------------------------------------------
-- Three of the errors in the Sept 2026 export read
--   "undefined is not an object (evaluating 'r[\"@context\"].toLowerCase')"
-- and are also an extension — one reading the page's structured data. They are
-- attributed to the document itself with no stack, so nothing distinguishes
-- them from our own inline code, and they are left alone rather than matched by
-- a guess. (Our own markup was checked and cleared: zero occurrences of
-- toLowerCase in the built HTML, and 0 of 123 pages had a JSON-LD block missing
-- @context.)
