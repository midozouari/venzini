// Page budget check (NFR-02, SDD 5.10.1): each page may load at most 250 kB of gzipped JS and CSS.
// It reads the Vite build manifest and, for every lazy-loaded page, adds up the app entry, the
// page's chunk and everything they import statically. Parts a page loads beside itself (the map
// card, so the page shows at once) are listed but not counted. The MVP mock API (MSW and the fixtures) is
// not part of v1 (SDD 7.4), so it is reported on its own line and not counted.
// Run after `pnpm build`: `pnpm size`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const BUDGET = 250_000; // bytes, the "kB" Vite prints
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const manifest = JSON.parse(readFileSync(join(dist, '.vite', 'manifest.json'), 'utf8'));

const gz = new Map();
const gzipped = (file) => {
  if (!gz.has(file)) gz.set(file, gzipSync(readFileSync(join(dist, file))).length);
  return gz.get(file);
};

/** Files loaded with a chunk: itself, its CSS and its static imports, recursively. */
function files(key, out = new Set()) {
  const chunk = manifest[key];
  if (!chunk || out.has(chunk.file)) return out;
  out.add(chunk.file);
  for (const css of chunk.css ?? []) out.add(css);
  for (const dep of chunk.imports ?? []) files(dep, out);
  return out;
}

const total = (set) => [...set].reduce((n, f) => n + gzipped(f), 0);
const kb = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;

const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
const entry = files(entryKey);
const pages = Object.keys(manifest)
  .filter((k) => /^src\/pages\/.+Page\.tsx$/.test(k) && manifest[k].isDynamicEntry)
  .sort();
if (pages.length === 0) throw new Error('No lazy-loaded pages found in the build manifest.');

let failed = false;
console.log(`Page budget (NFR-02): at most ${kb(BUDGET)} gzipped per page\n`);
console.log(`${'page'.padEnd(48)} ${'page load'.padStart(9)}   loaded beside it`);
for (const key of pages) {
  const own = files(key, new Set(entry));
  const size = total(own);
  const ok = size <= BUDGET;
  failed ||= !ok;
  // Parts the page loads on its own right after it shows (the map card), listed for the record.
  const beside = new Set();
  for (const dep of manifest[key].dynamicImports ?? []) files(dep, beside);
  const extra = total(new Set([...beside].filter((f) => !own.has(f))));
  const name = key.replace(/^src\/pages\//, '').replace(/\.tsx$/, '');
  console.log(
    `${ok ? 'ok  ' : 'OVER'}  ${name.padEnd(42)} ${kb(size).padStart(9)}   ${extra ? `+ ${kb(extra)}` : ''}`,
  );
}

const mockKey = Object.keys(manifest).find((k) => k.endsWith('src/mocks/browser.ts'));
if (mockKey) {
  const mock = [...files(mockKey)].filter((f) => !entry.has(f));
  console.log(
    `\nMVP mock API (MSW + fixtures), loaded once at start, not part of v1: ${kb(total(mock))}`,
  );
}

if (failed) {
  console.error('\nAt least one page is over the budget.');
  process.exit(1);
}
