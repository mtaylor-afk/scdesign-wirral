// WV Roofing — make (or check) the PGlite data directory snapshot mode starts from.
//
//   node scripts/wvroofing/gen-pglite-base.mjs           write db/wvroofing-pglite/base.tar.gz + base.json
//   node scripts/wvroofing/gen-pglite-base.mjs --check   fail if it is missing or out of date
//
// Every new Vercel instance in snapshot mode (serverlib/wvroofing/db.js) needs a
// PGlite with the schema. Made from nothing that is PGlite's initdb plus every
// migration: 10-30 s of CPU on one vCPU (measured 2026-10-04). Starting from this
// data directory, made once here with the same migrations, takes about 3 s.
// It holds the schema only, never a row. Run this again after adding a migration
// or upgrading @electric-sql/pglite (the tests check both); a newer migration is
// still applied at start-up if this file is behind.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const db = require(path.join(repo, "serverlib/wvroofing/db.js"));
const pkg = JSON.parse(fs.readFileSync(path.join(repo, "node_modules/@electric-sql/pglite/package.json"), "utf8"));
const infoFile = path.join(path.dirname(db.PGLITE_BASE), "base.json");
const latest = Math.max(...db.migrationFiles().map((f) => Number(f.slice(0, 4))));

if (process.argv.includes("--check")) {
  const problems = [];
  if (!fs.existsSync(db.PGLITE_BASE) || !fs.existsSync(infoFile)) problems.push("missing");
  else {
    const info = JSON.parse(fs.readFileSync(infoFile, "utf8"));
    const sha = crypto.createHash("sha256").update(fs.readFileSync(db.PGLITE_BASE)).digest("hex");
    if (info.pglite !== pkg.version) problems.push("made with PGlite " + info.pglite + ", installed " + pkg.version);
    if (info.migration !== latest) problems.push("has migrations up to " + info.migration + ", latest is " + latest);
    if (info.sha256 !== sha) problems.push("base.tar.gz doesn't match base.json");
  }
  if (problems.length) {
    console.error("db/wvroofing-pglite/base.tar.gz is out of date (" + problems.join("; ") + "): run node scripts/wvroofing/gen-pglite-base.mjs");
    process.exit(1);
  }
  console.log("the PGlite base is up to date (PGlite " + pkg.version + ", migration " + latest + ")");
  process.exit(0);
}

const { PGlite } = await import("@electric-sql/pglite");
const pg = new PGlite();
await pg.waitReady;
const version = await pg.transaction((t) =>
  db.applyMigrations({
    query: async (text, params) => {
      const r = await t.query(text, params || []);
      return { rows: r.rows, rowCount: r.affectedRows != null ? r.affectedRows : r.rows.length };
    },
    exec: async (sql) => {
      await t.exec(sql);
    },
  })
);
const rows = await pg.query("SELECT count(*)::int AS n FROM wvr_projects");
if (rows.rows[0].n !== 0) throw new Error("the base must hold no rows");
const dump = Buffer.from(await (await pg.dumpDataDir("gzip")).arrayBuffer());
await pg.close();
fs.mkdirSync(path.dirname(db.PGLITE_BASE), { recursive: true });
fs.writeFileSync(db.PGLITE_BASE, dump);
fs.writeFileSync(
  infoFile,
  JSON.stringify({ pglite: pkg.version, migration: version, bytes: dump.length, sha256: crypto.createHash("sha256").update(dump).digest("hex") }, null, 2) + "\n"
);
console.log("wrote " + path.relative(repo, db.PGLITE_BASE) + " (" + Math.round(dump.length / 1024) + " KB, PGlite " + pkg.version + ", migration " + version + ")");
process.exit(0);
