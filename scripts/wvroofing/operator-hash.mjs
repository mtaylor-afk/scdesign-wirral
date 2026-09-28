// WV Roofing — make the hash of the operator screen's password.
//
//   node scripts/wvroofing/operator-hash.mjs
//
// Run it yourself, in a terminal on your own computer. It asks for the password
// twice (nothing shows as you type) and prints one line: a scrypt hash. Paste
// only that line into Vercel -> scdesign-wirral -> Settings -> Environment
// Variables as WVR_OPERATOR_PASSWORD_HASH (Production), then redeploy.
// The password itself is never saved, sent anywhere or printed.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const auth = require("../../serverlib/wvroofing/auth.js");

const MIN_LENGTH = 12;

/** Read a line from the terminal without showing it. */
function hidden(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY) {
      reject(new Error("Run this in a terminal window, so the password can be typed without showing."));
      return;
    }
    process.stdout.write(prompt);
    let value = "";
    const done = () => {
      input.setRawMode(false);
      input.pause();
      input.removeListener("data", onData);
      process.stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          done();
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          done();
          reject(new Error("Cancelled."));
          return;
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    };
    input.setRawMode(true);
    input.setEncoding("utf8");
    input.on("data", onData);
    input.resume();
  });
}

async function main() {
  console.log("WV Roofing operator password (at least " + MIN_LENGTH + " characters; a few unrelated words work well).");
  const first = await hidden("Password: ");
  if (first.length < MIN_LENGTH) throw new Error("That's shorter than " + MIN_LENGTH + " characters. Nothing was made; please run it again.");
  if (first === auth.TEST_OPERATOR_PASSWORD) throw new Error("That's the test environment's password. Please choose your own.");
  const second = await hidden("Type it again: ");
  if (first !== second) throw new Error("The two didn't match. Nothing was made; please run it again.");
  const hash = auth.hashPassword(first);
  if (!(await auth.verifyPassword(first, hash))) throw new Error("The hash didn't check out. Please run it again.");
  console.log("\nYour hash (copy the whole line; it is not the password):\n\n" + hash + "\n");
  console.log("Paste it into Vercel as WVR_OPERATOR_PASSWORD_HASH (Production), then redeploy.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
