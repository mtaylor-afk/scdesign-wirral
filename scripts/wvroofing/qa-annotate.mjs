// Turns a browser-QA log into GitHub Actions annotations, so a live check's results can be
// read from the run's page (or the API) without opening the log.
//
//   node scripts/wvroofing/qa-annotate.mjs qa.log <qa exit status>
//   node scripts/wvroofing/qa-annotate.mjs --health health.json
//
// GitHub shows at most 10 annotations of each kind per step: the first 9 failures in full,
// then every failure's name in one; up to 10 skips; the total; and on a failure the end of
// the log (a crash's stack trace lives there). Messages are escaped as workflow commands
// need (% CR LF) and cut by characters, never mid-character.
import fs from "node:fs";

const esc = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escProp = (s) => esc(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
const cut = (s, n) => {
  const chars = Array.from(String(s));
  return chars.length > n ? chars.slice(0, n - 1).join("") + "…" : chars.join("");
};
const say = (kind, msg, title) => console.log("::" + kind + (title ? " title=" + escProp(title) : "") + "::" + esc(msg));

const args = process.argv.slice(2);
if (args[0] === "--health") {
  const text = fs.existsSync(args[1]) ? fs.readFileSync(args[1], "utf8").trim() : "";
  say("notice", cut(text || "no answer", 4000), "health");
  process.exit(0);
}

const lines = fs.existsSync(args[0]) ? fs.readFileSync(args[0], "utf8").split(/\r?\n/) : [];
const status = Number(args[1] || 0);
const fails = lines.filter((l) => l.startsWith("FAIL"));
for (const l of fails.slice(0, 9)) say("error", cut(l, 900));
if (fails.length > 9) say("error", fails.map((l) => l.replace(/ - .*$/, "")).join("\n"), "all failures");
for (const l of lines.filter((l) => l.startsWith("SKIP")).slice(0, 10)) say("warning", cut(l, 900));
const last = lines.filter((l) => l.trim()).pop() || "no output";
say("notice", cut(last, 900), "result");
if (status !== 0) {
  const tail = lines.filter((l) => l.trim()).slice(-30).map((l) => cut(l, 300));
  say("notice", tail.join("\n"), "log tail");
}
