// WV Roofing — database access. Three ways to run, chosen from the settings:
//
// 1. A Postgres database (WVR_DATABASE_URL / DATABASE_URL / POSTGRES_URL, e.g.
//    Neon) through `pg` on the pooled connection string, with
//    attachDatabasePool() so Fluid compute releases idle clients.
// 2. The test environment (WVR_ENV=test): PGlite, a real Postgres compiled to
//    WebAssembly, in memory, so tests and the dev server run the same SQL and
//    migrations offline.
// 3. "Snapshot" mode (since 2026-10-03, Matthew's choice so that nothing has to
//    be set up): no database URL, but the Supabase project SC Design already has
//    is on this Vercel project. The database is PGlite in memory, and WV Roofing's
//    rows (every wvr_ table, as COPY text, gzipped JSON: a few KB) are saved as
//    one snapshot in WV Roofing's own private bucket (supabase.js).
//    - A request that can change things (POST and the rest) takes a WRITE turn:
//      it holds a lock object in the bucket, loads the newest snapshot if this
//      instance's copy is older, runs, and saves a new snapshot if the rows changed.
//    - A GET takes a READ turn: no lock; the copy is brought up to date if it was
//      last checked over 2 seconds ago, and reads run side by side. A GET that
//      did change something (a rate-limit count, an audit row) saves under the
//      lock afterwards, unless another instance saved first (then that change is
//      dropped: it can only be a count or a log line).
//    Slower than a real database (a few tenths of a second a request, more for one
//    that writes), fine for a concept site; setting a database URL later switches
//    to (1) with no other change. The whole-data-directory snapshot was measured
//    first and rejected: 4.7 MB and 5 seconds a save.
//
// Migrations: numbered files in db/wvroofing/NNNN_name.sql, applied in order
// inside ONE transaction holding pg_advisory_xact_lock (safe behind PgBouncer
// transaction pooling), on first database use per instance (and per snapshot loaded).
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const { AsyncLocalStorage } = require("async_hooks");
const { HttpError } = require("./core.js");
const { databaseUrl, isTest } = require("./capabilities.js");

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "db", "wvroofing");
const MIGRATION_LOCK = 7273770001; // arbitrary constant for pg_advisory_xact_lock

// Snapshot mode's objects in the bucket.
const SNAP_LOCK = "db/lock.json";
const SNAP_HEAD = "db/head.json";
const LOCK_WAIT_MS = 25000; // how long a request waits for its turn
const LOCK_STALE_MS = 90000; // a lock older than this was left by a crashed request
const READ_FRESH_MS = 2000; // a read uses this instance's copy if it was checked this recently
const DAILY_CHECK_MS = 6 * 3600 * 1000;

/**
 * @typedef {{ rows: any[], rowCount: number }} QueryResult
 * @typedef {(text: string, params?: unknown[]) => Promise<QueryResult>} QueryFn
 * @typedef {{ query: QueryFn, exec: (sql: string) => Promise<void> }} TxClient
 * @typedef {object} Driver
 * @property {"pg" | "pglite" | "snapshot"} kind
 * @property {QueryFn} query
 * @property {<T>(fn: (t: TxClient) => Promise<T>) => Promise<T>} tx
 * @property {() => Promise<void>} end
 */

/** @type {Promise<Driver> | null} */
let driverPromise = null;
/** @type {Promise<number> | null} */
let schemaPromise = null;

/**
 * Snapshot mode: no database URL and not the test environment, but Supabase is there.
 * @param {Record<string, string | undefined>} env
 */
function snapshotMode(env) {
  return !databaseUrl(env) && !isTest(env) && require("./supabase.js").configured(env);
}

/** @param {Record<string, string | undefined>} env */
function configured(env) {
  return !!databaseUrl(env) || isTest(env) || snapshotMode(env);
}

/** An empty PGlite in memory. */
async function newPglite() {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  await pg.waitReady;
  return pg;
}

/**
 * @param {import("pg").Pool} pool
 * @returns {Driver}
 */
function pgDriver(pool) {
  return {
    kind: "pg",
    query: async (text, params) => {
      const r = await pool.query(text, /** @type {any[]} */ (params || []));
      return { rows: r.rows, rowCount: r.rowCount || 0 };
    },
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn({
          query: async (text, params) => {
            const r = await client.query(text, /** @type {any[]} */ (params || []));
            return { rows: r.rows, rowCount: r.rowCount || 0 };
          },
          exec: async (sql) => {
            await client.query(sql);
          },
        });
        await client.query("COMMIT");
        return out;
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch (e) {
          // the connection is already broken; the original error matters more
        }
        throw err;
      } finally {
        client.release();
      }
    },
    end: () => pool.end(),
  };
}

/**
 * @param {string | undefined} dir  optional on-disk data directory (default: in memory)
 * @returns {Promise<Driver>}
 */
async function pgliteDriver(dir) {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(dir || undefined);
  await pg.waitReady;
  /** @param {any} r */
  const shape = (r) => ({ rows: r.rows, rowCount: r.affectedRows != null ? r.affectedRows : r.rows.length });
  return {
    kind: "pglite",
    query: async (text, params) => shape(await pg.query(text, params || [])),
    tx: (fn) =>
      pg.transaction(async (/** @type {any} */ t) =>
        fn({
          query: async (text, params) => shape(await t.query(text, params || [])),
          exec: async (sql) => {
            await t.exec(sql);
          },
        })
      ),
    end: () => pg.close(),
  };
}

// ---------------------------------------------------------------------------
// snapshot mode

/**
 * This instance's copy of the database: the PGlite in memory, which saved
 * snapshot it matches (version, and a fingerprint of its rows), and when the
 * bucket was last checked for a newer one.
 * @type {{ pg: any, version: number, hash: string, checkedAt: number, dailyCheckedAt: number }}
 */
const SNAP = { pg: null, version: -1, hash: "", checkedAt: 0, dailyCheckedAt: 0 };
/** The turn a piece of work belongs to: { active, wrote }. */
const session$ = new AsyncLocalStorage();

/** Might this statement change anything? (Conservative: the rows are compared before anything is saved.) @param {string} sql */
function writes(sql) {
  return !/^\s*select\b/i.test(sql) || /\b(insert|update|delete|create|alter|drop|truncate|nextval|setval)\b/i.test(sql);
}

/** Mark the current turn as one that may have changed something. @param {string} sql */
function noteWrite(sql) {
  const s = session$.getStore();
  if (s && writes(sql)) s.wrote = true;
}

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A table or column name, quoted for SQL. @param {string} name */
const ident = (name) => '"' + String(name).replace(/"/g, '""') + '"';

/** @returns {Driver} */
function snapshotDriver() {
  /** @param {any} r */
  const shape = (r) => ({ rows: r.rows, rowCount: r.affectedRows != null ? r.affectedRows : r.rows.length });
  const pg = () => {
    if (!SNAP.pg) throw new HttpError(503, "busy", "WV Roofing's store isn't ready. Please try again.", { retryAfter: 3 });
    return SNAP.pg;
  };
  return {
    kind: "snapshot",
    query: async (text, params) => {
      const db = pg();
      noteWrite(text);
      return shape(await db.query(text, params || []));
    },
    tx: async (fn) =>
      pg().transaction(async (/** @type {any} */ t) =>
        fn({
          query: async (text, params) => {
            noteWrite(text);
            return shape(await t.query(text, params || []));
          },
          exec: async (sql) => {
            noteWrite(sql);
            await t.exec(sql);
          },
        })
      ),
    end: async () => {
      if (SNAP.pg) await SNAP.pg.close();
      SNAP.pg = null;
      SNAP.version = -1;
    },
  };
}

// --- turns inside this instance: any number of reads at once, or one write.
// A write that is waiting goes before reads that arrive after it.

/** @type {{ readers: number, writer: boolean, waiting: { write: boolean, go: () => void }[] }} */
const turns = { readers: 0, writer: false, waiting: [] };

function admit() {
  while (turns.waiting.length) {
    const next = turns.waiting[0];
    if (next.write ? turns.writer || turns.readers > 0 : turns.writer) return;
    turns.waiting.shift();
    if (next.write) turns.writer = true;
    else turns.readers++;
    next.go();
  }
}

/**
 * Wait for a turn in this instance.
 * @param {boolean} write
 * @returns {Promise<() => void>} call it to leave
 */
function enter(write) {
  return new Promise((resolve) => {
    turns.waiting.push({
      write,
      go: () => {
        let left = false;
        resolve(() => {
          if (left) return;
          left = true;
          if (write) turns.writer = false;
          else turns.readers--;
          admit();
        });
      },
    });
    admit();
  });
}

// --- the lock across instances: an object in the bucket

/**
 * Take the lock: an object made only if it isn't there (x-upsert false). A lock
 * older than LOCK_STALE_MS was left by a request that crashed, and is cleared.
 * @returns {Promise<{ owner: string, at: number }>}
 */
async function acquireLock() {
  const sb = require("./supabase.js");
  const owner = crypto.randomBytes(9).toString("hex");
  const deadline = Date.now() + (Number(process.env.WVR_SNAPSHOT_LOCK_WAIT_MS) || LOCK_WAIT_MS);
  for (;;) {
    const at = Date.now();
    const made = await sb.upload(SNAP_LOCK, JSON.stringify({ owner, at }), "application/json", { upsert: false });
    if (made.ok) return { owner, at };
    const held = await sb.download(SNAP_LOCK);
    if (!held) continue; // released between the two calls: try again at once
    let heldAt = 0;
    try {
      const mark = JSON.parse(held.buf.toString("utf8"));
      // Our own: the upload worked but its reply was lost (and was sent again).
      if (mark.owner === owner) return { owner, at: Number(mark.at) || at };
      heldAt = Number(mark.at) || 0;
    } catch (err) {
      heldAt = 0;
    }
    if (Date.now() - heldAt > LOCK_STALE_MS) {
      await sb.remove([SNAP_LOCK]);
      continue;
    }
    if (Date.now() > deadline) throw new HttpError(503, "busy", "WV Roofing is busy for a moment. Please try again.", { retryAfter: 3 });
    await sleep(120 + Math.floor(Math.random() * 230));
  }
}

/** Give the lock back, if it is still ours. @param {{ owner: string, at: number }} lock */
async function releaseLock(lock) {
  const sb = require("./supabase.js");
  try {
    // Well inside the stale limit nobody can have taken it over, so it is simply removed.
    if (Date.now() - lock.at < LOCK_STALE_MS - 30000) {
      await sb.remove([SNAP_LOCK]);
      return;
    }
    const held = await sb.download(SNAP_LOCK);
    if (held && JSON.parse(held.buf.toString("utf8")).owner === lock.owner) await sb.remove([SNAP_LOCK]);
  } catch (err) {
    console.error("[wvroofing] lock release failed", err instanceof Error ? err.message : err);
  }
}

// --- the rows: every wvr_ table (but the migrations' own), as COPY text

/**
 * Each wvr_ table's columns, in order.
 * @param {any} pg
 * @returns {Promise<Record<string, string[]>>}
 */
async function columnsByTable(pg) {
  const { rows } = await pg.query(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name LIKE 'wvr\\_%' " +
      "AND table_name <> 'wvr_schema_migrations' AND is_generated = 'NEVER' ORDER BY table_name, ordinal_position"
  );
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const r of rows) (out[r.table_name] = out[r.table_name] || []).push(String(r.column_name));
  return out;
}

/**
 * Every row, and where each sequence has got to, as one JSON text and its fingerprint.
 * @param {any} pg
 * @returns {Promise<{ json: string, hash: string }>}
 */
async function exportRows(pg) {
  /** @type {{ format: number, tables: Record<string, { columns: string[], rows: string }>, sequences: Record<string, string> }} */
  const snap = { format: 1, tables: {}, sequences: {} };
  for (const [table, columns] of Object.entries(await columnsByTable(pg))) {
    const r = await pg.query("COPY " + ident(table) + " (" + columns.map(ident).join(", ") + ") TO '/dev/blob'");
    snap.tables[table] = { columns, rows: r.blob ? await r.blob.text() : "" };
  }
  const seqs = await pg.query("SELECT sequencename, last_value::text AS v FROM pg_sequences WHERE schemaname = 'public' AND last_value IS NOT NULL ORDER BY sequencename");
  for (const r of seqs.rows) snap.sequences[r.sequencename] = r.v;
  const json = JSON.stringify(snap);
  return { json, hash: crypto.createHash("sha256").update(json).digest("hex") };
}

/**
 * Replace every row with a snapshot's (none: empty tables). A column this
 * version of the code no longer has is left out; a new one takes its default.
 * @param {any} pg
 * @param {{ tables?: Record<string, { columns: string[], rows: string }>, sequences?: Record<string, string> } | null} snap
 */
async function importRows(pg, snap) {
  const have = await columnsByTable(pg);
  const { rows: seqRows } = await pg.query("SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'");
  await pg.transaction(async (/** @type {any} */ t) => {
    // The rows were consistent when saved, so foreign keys aren't checked again row by row.
    await t.exec("SET LOCAL session_replication_role = replica");
    const tables = Object.keys(have);
    if (tables.length) await t.exec("TRUNCATE " + tables.map(ident).join(", "));
    for (const [table, data] of Object.entries((snap && snap.tables) || {})) {
      if (!have[table] || !data || typeof data.rows !== "string" || !data.rows || !Array.isArray(data.columns)) continue;
      const keep = data.columns.map((c, i) => (have[table].includes(c) ? i : -1)).filter((i) => i >= 0);
      if (!keep.length) continue;
      let text = data.rows;
      // COPY's text format escapes tabs and newlines inside values, so raw ones only separate fields and rows.
      if (keep.length !== data.columns.length) {
        text =
          text
            .split("\n")
            .filter(Boolean)
            .map((line) => {
              const f = line.split("\t");
              return keep.map((i) => f[i]).join("\t");
            })
            .join("\n") + "\n";
      }
      const cols = keep.map((i) => data.columns[i]);
      await t.query("COPY " + ident(table) + " (" + cols.map(ident).join(", ") + ") FROM '/dev/blob'", [], { blob: new Blob([text]) });
    }
    const saved = (snap && snap.sequences) || {};
    for (const r of seqRows) {
      const name = "public." + ident(r.sequencename);
      if (saved[r.sequencename]) await t.query("SELECT setval($1::regclass, $2::bigint, true)", [name, saved[r.sequencename]]);
      else await t.query("SELECT setval($1::regclass, 1, false)", [name]);
    }
  });
}

// --- the snapshot in the bucket

/** Which snapshot is the newest: { version, key } (version 0: none saved yet). */
async function readHead() {
  const head = await require("./supabase.js").download(SNAP_HEAD);
  if (!head) return { version: 0, key: "" };
  try {
    const h = JSON.parse(head.buf.toString("utf8"));
    return { version: Number(h.version) || 0, key: typeof h.key === "string" ? h.key : "" };
  } catch (err) {
    throw new HttpError(503, "busy", "WV Roofing's saved data couldn't be read just now. Please try again.", { retryAfter: 5 });
  }
}

/** Bring this instance's copy up to the newest snapshot (the caller has this instance to itself). */
async function syncSnapshot() {
  const head = await readHead();
  SNAP.checkedAt = Date.now();
  if (SNAP.pg && SNAP.version === head.version) return;
  if (!SNAP.pg) {
    SNAP.pg = await newPglite();
    SNAP.version = -1;
    schemaPromise = null;
  }
  await ensureSchema();
  let data = null;
  if (head.key) {
    const got = await require("./supabase.js").download(head.key);
    // Never carry on with empty tables when saved rows exist: the next save would wipe them.
    if (!got) throw new HttpError(503, "busy", "WV Roofing's saved data couldn't be read just now. Please try again.", { retryAfter: 5 });
    try {
      data = JSON.parse(zlib.gunzipSync(got.buf).toString("utf8"));
    } catch (err) {
      throw new HttpError(503, "busy", "WV Roofing's saved data couldn't be read just now. Please try again.", { retryAfter: 5 });
    }
  }
  await importRows(SNAP.pg, data);
  SNAP.hash = (await exportRows(SNAP.pg)).hash;
  SNAP.version = head.version;
}

/**
 * Save the rows as the newest snapshot, if they changed (the caller holds the
 * lock and has this instance to itself).
 * @param {{ json: string, hash: string }} [rows]  already exported
 */
async function saveChanges(rows) {
  const e = rows || (await exportRows(SNAP.pg));
  if (e.hash === SNAP.hash) return;
  const sb = require("./supabase.js");
  const version = SNAP.version + 1;
  const key = "db/rows-" + version + ".json.gz";
  try {
    const gz = zlib.gzipSync(e.json);
    await sb.upload(key, gz, "application/gzip", { upsert: true });
    await sb.upload(SNAP_HEAD, JSON.stringify({ version, key, bytes: gz.length, at: new Date().toISOString() }), "application/json", { upsert: true });
  } catch (err) {
    // This copy now has changes the bucket may not: the next turn starts again from the saved one.
    SNAP.version = -1;
    console.error("[wvroofing] snapshot save failed", err instanceof Error ? err.message : err);
    throw new HttpError(503, "busy", "That couldn't be saved just now. Please try again.", { retryAfter: 3 });
  }
  const spare = SNAP.version - 1; // the one before is kept as a spare; older ones go
  SNAP.version = version;
  SNAP.hash = e.hash;
  SNAP.checkedAt = Date.now();
  if (spare >= 1) await sb.remove(["db/rows-" + spare + ".json.gz"]).catch(() => undefined);
}

/**
 * Run fn as part of a turn, noting whether it may have changed anything. Work it
 * starts that carries on after the turn (e.g. after the reply) takes turns of its own.
 * @param {() => Promise<any>} fn
 */
async function inTurn(fn) {
  const store = { active: true, wrote: false };
  try {
    return { store, failed: false, error: /** @type {unknown} */ (null), value: await session$.run(store, fn) };
  } catch (error) {
    return { store, failed: true, error, value: undefined };
  } finally {
    store.active = false;
  }
}

/**
 * A turn that may change things: the lock, the newest rows, fn, and a save if
 * the rows changed (even when fn failed: what it wrote stays written, as it would in Postgres).
 * @param {() => Promise<any>} fn
 */
async function writeTurn(fn) {
  const leave = await enter(true);
  try {
    const lock = await acquireLock();
    try {
      await syncSnapshot();
      const out = await inTurn(fn);
      if (out.store.wrote) await saveChanges();
      if (out.failed) throw out.error;
      return out.value;
    } finally {
      await releaseLock(lock);
    }
  } finally {
    leave();
  }
}

/**
 * A turn that only reads (a GET): no lock, reads side by side, and this
 * instance's copy unless it was last checked over READ_FRESH_MS ago.
 * @param {() => Promise<any>} fn
 */
async function readTurn(fn) {
  const stale = () => !SNAP.pg || SNAP.version < 0 || Date.now() - SNAP.checkedAt > READ_FRESH_MS;
  if (stale()) {
    const leave = await enter(true);
    try {
      if (stale()) await syncSnapshot();
    } finally {
      leave();
    }
  }
  const leave = await enter(false);
  /** @type {Awaited<ReturnType<typeof inTurn>>} */
  let out;
  try {
    out = await inTurn(fn);
  } finally {
    leave();
  }
  if (out.store.wrote) await saveAfterRead();
  if (out.failed) throw out.error;
  return out.value;
}

/**
 * A read changed something (a rate-limit count, an audit row): save it under
 * the lock, unless another instance saved first (then it is dropped).
 */
async function saveAfterRead() {
  const leave = await enter(true);
  try {
    if (SNAP.version < 0) return;
    const rows = await exportRows(SNAP.pg);
    if (rows.hash === SNAP.hash) return;
    const lock = await acquireLock();
    try {
      const head = await readHead();
      SNAP.checkedAt = Date.now();
      if (head.version === SNAP.version) {
        await saveChanges(rows);
      } else {
        SNAP.version = -1;
        console.warn("[wvroofing] a change made during a read was overtaken by another save and dropped");
      }
    } finally {
      await releaseLock(lock);
    }
  } finally {
    leave();
  }
}

/**
 * The daily tidy-up (retention), at most once a day, run inside requests:
 * snapshot mode doesn't rely on CRON_SECRET for Vercel's own cron.
 */
async function maybeDaily() {
  if (Date.now() - SNAP.dailyCheckedAt < DAILY_CHECK_MS) return;
  SNAP.dailyCheckedAt = Date.now();
  const due = async () => {
    const { rows } = await query("SELECT max(started_at) AS last FROM wvr_retention_runs WHERE kind = 'daily'");
    const last = rows[0] && rows[0].last ? new Date(rows[0].last).getTime() : 0;
    return Date.now() - last > 23 * 3600 * 1000;
  };
  try {
    if (await readTurn(due)) {
      await writeTurn(async () => {
        if (await due()) await require("./cron/daily.js").runDaily(Date.now());
      });
    }
  } catch (err) {
    console.error("[wvroofing] daily tidy-up failed", err instanceof Error ? err.message : err);
  }
}

/**
 * Run fn as one turn on the database. In snapshot mode a read turn when
 * opts.write is false (a GET), otherwise a write turn (above); in the other
 * modes, and inside a turn already, it just runs fn.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ write?: boolean }} [opts]
 * @returns {Promise<T>}
 */
async function session(fn, opts) {
  const s = session$.getStore();
  if (!snapshotMode(process.env) || (s && s.active)) return fn();
  const out = opts && opts.write === false ? await readTurn(fn) : await writeTurn(fn);
  await maybeDaily();
  return out;
}

/** @param {Record<string, string | undefined>} env */
async function createDriver(env) {
  const url = databaseUrl(env);
  if (url) {
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000 });
    try {
      require("@vercel/functions").attachDatabasePool(pool);
    } catch (err) {
      // not on Vercel (local run against a real database): nothing to attach to
    }
    return pgDriver(pool);
  }
  if (isTest(env)) return pgliteDriver(env.WVR_PGLITE_DIR);
  if (snapshotMode(env)) return snapshotDriver();
  throw new HttpError(503, "not_configured", "Project storage isn't set up yet.");
}

/** @returns {Promise<Driver>} */
function driver() {
  if (!driverPromise) {
    driverPromise = createDriver(process.env).catch((err) => {
      driverPromise = null;
      throw err;
    });
  }
  return driverPromise;
}

/** @returns {Promise<number>} the latest applied migration version */
async function migrate() {
  const d = await driver();
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f))
    .sort();
  return d.tx(async (t) => {
    await t.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK]);
    await t.exec(
      "CREATE TABLE IF NOT EXISTS wvr_schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())"
    );
    const { rows } = await t.query("SELECT version FROM wvr_schema_migrations");
    const have = new Set(rows.map((r) => Number(r.version)));
    let latest = 0;
    for (const f of files) {
      const v = Number(f.slice(0, 4));
      latest = Math.max(latest, v);
      if (have.has(v)) continue;
      await t.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
      await t.query("INSERT INTO wvr_schema_migrations (version, name) VALUES ($1, $2)", [v, f]);
    }
    return latest;
  });
}

/** Apply pending migrations once per instance. @returns {Promise<number>} */
function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = migrate().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

/** Snapshot mode, outside a turn (e.g. work after the reply): this call takes a turn of its own. */
function needsTurn() {
  const s = session$.getStore();
  return snapshotMode(process.env) && !(s && s.active);
}

/** @type {QueryFn} */
async function query(text, params) {
  if (needsTurn()) return session(() => query(text, params));
  await ensureSchema();
  return (await driver()).query(text, params);
}

/**
 * Run fn inside a transaction (schema guaranteed first).
 * @template T
 * @param {(t: TxClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function tx(fn) {
  if (needsTurn()) return session(() => tx(fn));
  await ensureSchema();
  return (await driver()).tx(fn);
}

/**
 * A named, time-limited lease (works across instances and behind a pooler,
 * unlike session advisory locks). Returns false when someone else holds it.
 * @template T
 * @param {string} name
 * @param {number} seconds
 * @param {() => Promise<T>} fn
 * @returns {Promise<{ held: false } | { held: true, result: T }>}
 */
async function withLease(name, seconds, fn) {
  const holder = crypto.randomBytes(12).toString("hex");
  const { rows } = await query(
    "INSERT INTO wvr_leases (name, holder, until) VALUES ($1, $2, now() + make_interval(secs => $3)) " +
      "ON CONFLICT (name) DO UPDATE SET holder = EXCLUDED.holder, until = EXCLUDED.until WHERE wvr_leases.until < now() " +
      "RETURNING holder",
    [name, holder, seconds]
  );
  if (!rows.length || rows[0].holder !== holder) return { held: false };
  try {
    return { held: true, result: await fn() };
  } finally {
    await query("DELETE FROM wvr_leases WHERE name = $1 AND holder = $2", [name, holder]);
  }
}

/** Test helper: drop the connection so the next call starts afresh. */
async function reset() {
  const d = driverPromise;
  driverPromise = null;
  schemaPromise = null;
  if (d) {
    try {
      await (await d).end();
    } catch (err) {
      // already closed
    }
  }
  if (SNAP.pg) {
    try {
      await SNAP.pg.close();
    } catch (err) {
      // already closed
    }
  }
  SNAP.pg = null;
  SNAP.version = -1;
  SNAP.hash = "";
  SNAP.checkedAt = 0;
  SNAP.dailyCheckedAt = 0;
  turns.readers = 0;
  turns.writer = false;
  turns.waiting = [];
}

/** What kind of database this is ("pg", "pglite" for tests, "snapshot"), without connecting. */
function mode() {
  const env = process.env;
  if (databaseUrl(env)) return "pg";
  if (isTest(env)) return "pglite";
  if (snapshotMode(env)) return "snapshot";
  return "none";
}

module.exports = { configured, snapshotMode, mode, session, ensureSchema, migrate, query, tx, withLease, reset, MIGRATIONS_DIR };