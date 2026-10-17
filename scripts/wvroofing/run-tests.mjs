// Runs every WV Roofing node:test suite. Node 22+ no longer accepts a folder
// for `node --test` (it tries to load it as a module), so the files are listed.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'tests');
const files = readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => join(dir, f));
const run = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...files], { stdio: 'inherit' });
process.exit(run.status ?? 1);
