// WV Roofing — database access.
//
// Production: Postgres (Neon, London) through `pg` on the pooled connection
// string, with attachDatabasePool() so Fluid compute releases idle clients.
// Test environment only (WVR_ENV=test, no database URL): PGlite, a real
// Postgres compiled to WebAssembly, so tests and the dev server run the same
// SQL and migrations offline. Production never loads PGlite.
//
// Migrations: numbered files in db/wvroofing/NNNN_name.sql, applied in order
// inside ONE transaction holding pg_advisory_xact_lock (safe behind PgBouncer
// transaction pooling), on first database use per instance.
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { HttpError } = require("./core.js");
const { databaseUrl, isTest } = require("./capabilities.js");

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "db", "wvroofing");
const MIGRATION_LOCK = 7273770001; // arbitrary constant for pg_advisory_xact_lock

/**
 * @typedef {{ rows: any[], rowCount: number }} QueryResult
 * @typedef {(text: string, params?: unknown[]) => Promise<QueryResult>} QueryFn
 * @typedef {{ query: QueryFn, exec: (sql: string) => Promise<void> }} TxClient
 * @typedef {object} Driver
 * @property {"pg" | "pglite"} kind
 * @property {QueryFn} query
 * @property {<T>(fn: (t: TxClient) => Promise<T>) => Promise<T>} tx
 * @property {() => Promise<void>} end
 */

/** @type {Promise<Driver> | null} */
let driverPromise = null;
/** @type {Promise<number> | null} */
let schemaPromise = null;

/** @param {Record<string, string | undefined>} env */
function configured(env) {
  return !!databaseUrl(env) || isTest(env);
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
  // Built from parts so Vercel's file tracer never bundles PGlite into production.
  const modName = ["@electric-sql", "pglite"].join("/");
  const { PGlite } = await import(modName);
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

/** @type {QueryFn} */
async function query(text, params) {
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
}

module.exports = { configured, ensureSchema, migrate, query, tx, withLease, reset, MIGRATIONS_DIR };
