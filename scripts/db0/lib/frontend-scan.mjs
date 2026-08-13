// WP-DB0 — scan actual frontend/service usage of the data contract.
//
// Finds every `.from('<relation>')` and `.rpc('<fn>')` call site, plus the
// column names each query selects, so the Contract Matrix can be built from
// real usage rather than from what the types file happens to declare.

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..', '..');
export const APP_SRC = join(ROOT, 'rentrix-app', 'src');

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', '__snapshots__']);
const CODE_EXT = /\.(ts|tsx)$/;

export async function walk(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) await walk(p, acc);
    } else if (CODE_EXT.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

export function isTestFile(relPath) {
  return /\.(test|spec)\.tsx?$/.test(relPath) || /(^|\/)(test|__tests__|e2e|__mocks__)\//.test(relPath);
}

const FROM_RE = /\.from\(\s*(['"`])([A-Za-z_][\w]*)\1\s*\)/g;
// `supabase.storage.from('bucket')` addresses a Storage bucket, not a relation.
// The `.storage` may sit on a previous line, so test the preceding text.
const STORAGE_PREFIX = /\.storage\s*$/;
const RPC_RE = /\.rpc\(\s*(['"`])([A-Za-z_][\w]*)\1/g;
// The select string may be followed by a cast (`as never`), a second argument,
// or the closing paren.
const SELECT_RE = /\.select\(\s*(['"`])([\s\S]*?)\1\s*(?:as\s+\w+\s*)?[),]/g;

/** Parse a PostgREST select string into top-level column tokens. */
export function parseSelect(selectStr) {
  const cols = [];
  let depth = 0;
  let token = '';
  for (const ch of selectStr) {
    if (ch === '(') {
      depth += 1;
      token += ch;
    } else if (ch === ')') {
      depth -= 1;
      token += ch;
    } else if (ch === ',' && depth === 0) {
      cols.push(token.trim());
      token = '';
    } else {
      token += ch;
    }
  }
  if (token.trim()) cols.push(token.trim());

  return cols
    .map((c) => c.replace(/\s+/g, ''))
    .filter(Boolean)
    .map((c) => {
      // Embedded resource: `rel(...)`, `alias:rel(...)`, `rel!inner(...)`,
      // `rel!fk_name(...)`, `alias:rel!inner(...)`.
      const embedded = /^(?:([\w]+):)?([\w]+)(?:!([\w]+))?\(([\s\S]*)\)$/.exec(c);
      if (embedded) {
        // PostgREST allows `alias:target(...)` where `target` is either a
        // relation name or an FK **column** on the parent that resolves to one
        // (e.g. `contracts:contract_id(...)`). Which one it is can only be
        // decided against the schema, so carry both readings.
        return {
          kind: 'embed',
          alias: embedded[1] ?? null,
          name: embedded[2],
          hint: embedded[3] ?? null,
          inner: embedded[4] ?? '',
          raw: c,
        };
      }
      const alias = /^([\w]+):([\w.]+)$/.exec(c);
      if (alias) return { kind: 'column', name: alias[2].split('.').pop(), raw: c };
      const cast = c.split('::')[0];
      return { kind: 'column', name: cast, raw: c };
    });
}

export async function scanFrontend({ includeTests = false } = {}) {
  const files = await walk(APP_SRC);
  const relations = new Map(); // name -> { files:Set, count, columns:Map }
  const rpcs = new Map(); // name -> { files:Set, count }
  const embeds = []; // unresolved PostgREST embedded resources

  const touch = (map, name) => {
    if (!map.has(name)) map.set(name, { name, files: new Set(), count: 0, columns: new Map() });
    return map.get(name);
  };

  for (const file of files) {
    const rel = relative(ROOT, file);
    if (!includeTests && isTestFile(rel)) continue;
    const src = await readFile(file, 'utf8');

    // relation usage + the select() that most closely follows it
    for (const m of src.matchAll(FROM_RE)) {
      const name = m[2];
      if (STORAGE_PREFIX.test(src.slice(Math.max(0, m.index - 40), m.index))) continue;
      const entry = touch(relations, name);
      entry.files.add(rel);
      entry.count += 1;

      const after = src.slice(m.index, m.index + 4000);
      SELECT_RE.lastIndex = 0;
      const sel = SELECT_RE.exec(after);
      if (sel && sel.index < 400) {
        for (const col of parseSelect(sel[2])) {
          if (col.kind === 'embed') {
            // Recorded as an unresolved embed; the drift engine resolves the
            // target against the schema and the FK graph.
            embeds.push({
              parent: name,
              alias: col.alias,
              target: col.name,
              hint: col.hint,
              columns: parseSelect(col.inner)
                .filter((s) => s.kind === 'column' && s.name && s.name !== '*')
                .map((s) => s.name),
              file: rel,
            });
            continue;
          }
          if (col.name === '*' || !col.name) continue;
          const prev = entry.columns.get(col.name) ?? { name: col.name, files: new Set() };
          prev.files.add(rel);
          entry.columns.set(col.name, prev);
        }
      }
    }

    for (const m of src.matchAll(RPC_RE)) {
      const name = m[2];
      const entry = touch(rpcs, name);
      entry.files.add(rel);
      entry.count += 1;
    }
  }

  const serialise = (map) =>
    [...map.values()]
      .map((e) => ({
        name: e.name,
        count: e.count,
        files: [...e.files].sort(),
        columns: [...e.columns.values()]
          .map((c) => ({ name: c.name, files: [...c.files].sort() }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

  return {
    scannedFiles: files.length,
    relations: serialise(relations),
    rpcs: serialise(rpcs).map(({ columns, ...r }) => r),
    embeds,
  };
}
