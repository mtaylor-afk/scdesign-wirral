// WV Roofing — regenerate the generated docs (currently the permissions record).
//
//   node scripts/wvroofing/gen-docs.mjs          write docs/wvroofing/permissions-record.md
//   node scripts/wvroofing/gen-docs.mjs --check  exit 1 if the committed file is out of date
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { toMarkdown } = require(path.join(repo, "serverlib/wvroofing/permissions.js"));

const file = path.join(repo, "docs/wvroofing/permissions-record.md");
const want = toMarkdown() + "\n";
if (process.argv.includes("--check")) {
  const have = fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n") : "";
  if (have !== want) {
    console.error("docs/wvroofing/permissions-record.md is out of date: run node scripts/wvroofing/gen-docs.mjs");
    process.exit(1);
  }
  console.log("permissions record is up to date");
} else {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, want);
  console.log("wrote " + path.relative(repo, file));
}
