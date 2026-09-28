// WV Roofing — how long everything is kept (A7; plan §4.5, docs/wvroofing/retention.md).
//
// One place for every period, so the code, the privacy notice and the docs can't
// drift apart: scripts/wvroofing/tests/retention.test.mjs checks the notice's
// wording against these numbers. Changing a period is a code change, made
// together with the privacy notice (which is why they aren't environment
// variables).
"use strict";

const db = require("./db.js");

const RETENTION = Object.freeze({
  // A visualiser project with no enquiry: photo, outline, renders, address, answers.
  projectDays: 30,
  // An enquiry, and the project it's about (the project's expiry is pushed out to match).
  enquiryMonths: 12,
  // Files of renders that were never shown (failed, cancelled, set aside).
  unusedRenderFileDays: 7,
  // Uploads presigned but never committed (and the upload records themselves).
  uploadHours: 24,
  // Rate-limit windows (keyed hashes, never an IP address).
  rateLimitHours: 48,
  // Operator sessions after they end, and login attempts.
  operatorSessionDays: 7,
  loginAttemptDays: 7,
  // The operator's history (who changed what), like enquiries.
  operatorHistoryMonths: 12,
  // The paid-call log and the daily budget ledger: no personal data once the
  // project is gone; kept for a year of cost history.
  providerCallMonths: 13,
  budgetDayMonths: 13,
  // The daily sweep's own record.
  retentionRunDays: 90,
});

/**
 * The daily sweep's share for records that outlive the projects they came from.
 * @returns {Promise<Record<string, number>>}
 */
async function purgeRecords() {
  const calls = await db.query("DELETE FROM wvr_provider_calls WHERE created_at < now() - make_interval(months => $1)", [RETENTION.providerCallMonths]);
  const days = await db.query("DELETE FROM wvr_budget_days WHERE day < ((now() AT TIME ZONE 'UTC')::date - make_interval(months => $1))::date", [RETENTION.budgetDayMonths]);
  const runs = await db.query("DELETE FROM wvr_retention_runs WHERE started_at < now() - make_interval(days => $1)", [RETENTION.retentionRunDays]);
  // Leases are released when their work ends; one left by a crashed run is gone a day after it ran out.
  const leases = await db.query("DELETE FROM wvr_leases WHERE until < now() - interval '1 day'");
  return { providerCallsPurged: calls.rowCount, budgetDaysPurged: days.rowCount, retentionRunsPurged: runs.rowCount, leasesPurged: leases.rowCount };
}

module.exports = { RETENTION, purgeRecords };
