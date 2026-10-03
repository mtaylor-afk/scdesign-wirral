// A second WV Roofing server instance for snapshot.test.mjs: a separate process,
// as each instance is on Vercel, using the same pretend Supabase (over local HTTP).
// Not a test file itself (node --test only runs *.test.mjs).
import { load, apiFor } from "./helpers.mjs";

const base = process.env.SC_SUPABASE_URL || "";
const local = process.env.WVR_FAKE_SUPABASE || "";
load("serverlib/wvroofing/supabase.js").setFetch((input, init) => fetch(String(input).replace(base, local), init));
const app = load("api/wvroofing/app.js");
const db = load("serverlib/wvroofing/db.js");
const api = apiFor(app);

process.on("message", async (m) => {
  try {
    if (m.reset) {
      await db.reset();
      process.send({ id: m.id, ok: true });
      return;
    }
    const r = await api(m.method, m.route, m.opts || {});
    process.send({ id: m.id, status: r.status, json: r.json, headers: r.headers });
  } catch (err) {
    process.send({ id: m.id, error: String((err && err.stack) || err) });
  }
});
process.on("disconnect", () => process.exit(0));
process.send({ ready: true });
