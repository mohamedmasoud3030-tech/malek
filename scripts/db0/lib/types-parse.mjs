// WP-DB0 — parse the hand-maintained `rentrix-app/src/types/database.ts`.
//
// The file is not `supabase gen types` output: it is hand-written with
// `Partial<...> & Pick<...>` Insert/Update helpers. A TypeScript-aware parse is
// therefore required rather than a naive regex over the whole file.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..', '..');
export const TYPES_PATH = join(ROOT, 'rentrix-app', 'src', 'types', 'database.ts');

/** Find the body of a `name: {` block, returning the text between braces. */
function blockBody(src, header, from = 0) {
  const idx = src.indexOf(header, from);
  if (idx < 0) return null;
  const open = src.indexOf('{', idx + header.length - 1);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { body: src.slice(open + 1, i), start: open + 1, end: i };
    }
  }
  return null;
}

/**
 * Split a block body into top-level `key: value` entries.
 *
 * Brace-, string- and comment-aware: a `//` comment may contain braces or a
 * semicolon (the generator writes `... in the database; PostgREST ...`), which
 * would otherwise split an entry in half.
 */
function topLevelEntries(body) {
  const entries = [];
  let depth = 0;
  let start = 0;
  let inString = null;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (inString) {
      if (ch === inString && body[i - 1] !== '\\') inString = null;
      continue;
    }
    // Skip line comments entirely.
    if (ch === '/' && body[i + 1] === '/') {
      const nl = body.indexOf('\n', i);
      i = nl === -1 ? body.length : nl;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') depth += 1;
    else if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
    else if ((ch === ';' || ch === ',') && depth === 0) {
      const chunk = body.slice(start, i).trim();
      if (chunk) entries.push(chunk);
      start = i + 1;
    }
  }
  const tail = body.slice(start).trim();
  if (tail) entries.push(tail);
  return entries;
}

function parseRowFields(rowBody) {
  const fields = [];
  for (const entry of topLevelEntries(rowBody)) {
    const m = /^([A-Za-z_$][\w$]*|'[^']+'|"[^"]+")(\?)?\s*:\s*([\s\S]+)$/.exec(entry);
    if (!m) continue;
    const name = m[1].replace(/^['"]|['"]$/g, '');
    fields.push({
      name,
      optional: Boolean(m[2]),
      type: m[3].trim().replace(/\s+/g, ' '),
    });
  }
  return fields;
}

export async function parseDatabaseTypes(path = TYPES_PATH) {
  const src = await readFile(path, 'utf8');

  const publicBlock = blockBody(src, 'public: {');
  if (!publicBlock) throw new Error('Could not locate `public:` block in database.ts');
  const pub = publicBlock.body;

  const result = { tables: {}, views: {}, functions: {}, enums: {}, path };

  for (const [section, key] of [
    ['Tables: {', 'tables'],
    ['Views: {', 'views'],
    ['Functions: {', 'functions'],
    ['Enums: {', 'enums'],
  ]) {
    const block = blockBody(pub, section);
    if (!block) continue;
    const body = block.body;
    if (/^\s*Record<string,\s*never>\s*$/.test(body) || !body.trim()) continue;

    for (const rawEntry of topLevelEntries(body)) {
      // `//` comment lines (the generator documents ambiguous overloads) may
      // sit before the key or, after splitting on `;`, be carried along at the
      // end of the previous entry. Drop every full-line comment first.
      const entry = rawEntry
        .split('\n')
        .filter((line) => !/^\s*\/\//.test(line))
        .join('\n')
        .trim();
      const m = /^([A-Za-z_$][\w$]*|'[^']+'|"[^"]+")\s*:\s*([\s\S]+)$/.exec(entry);
      if (!m) continue;
      const name = m[1].replace(/^['"]|['"]$/g, '');
      const value = m[2].trim();

      if (key === 'enums') {
        result.enums[name] = value;
        continue;
      }
      if (key === 'functions') {
        const argsBlock = blockBody(value, 'Args: {');
        const returnsMatch = /Returns\s*:\s*([\s\S]+?)(?:;|$)/.exec(value);
        result.functions[name] = {
          args: argsBlock ? parseRowFields(argsBlock.body).map((f) => f.name) : [],
          argFields: argsBlock ? parseRowFields(argsBlock.body) : [],
          returns: returnsMatch ? returnsMatch[1].trim().replace(/\s+/g, ' ') : null,
          raw: value,
        };
        continue;
      }

      const rowBlock = blockBody(value, 'Row: {');
      result[key][name] = {
        row: rowBlock ? parseRowFields(rowBlock.body) : [],
        raw: value,
      };
    }
  }

  return result;
}

/**
 * Map a TypeScript field type back to the set of Postgres udt_names that can
 * legitimately produce it. Used to detect real type drift (text vs uuid vs
 * numeric vs date) without flagging cosmetic differences.
 */
export function tsTypeToPgCandidates(tsType) {
  const t = tsType.replace(/\s*\|\s*null$/, '').trim();
  const nullable = /\|\s*null/.test(tsType);

  // String-literal unions map to text/varchar or a pg enum.
  if (/^'(?:[^']*)'(?:\s*\|\s*'(?:[^']*)')*$/.test(t)) {
    return { kind: 'enum-like', nullable, literals: t.split('|').map((s) => s.trim().replace(/'/g, '')) };
  }

  const base = {
    string: ['text', 'varchar', 'bpchar', 'uuid', 'date', 'timestamptz', 'timestamp', 'time', 'citext', 'inet', 'jsonb', 'json', 'numeric'],
    number: ['int2', 'int4', 'int8', 'numeric', 'float4', 'float8'],
    boolean: ['bool'],
    Json: ['jsonb', 'json'],
    'string[]': ['_text', '_varchar', '_uuid'],
    'number[]': ['_int4', '_int8', '_numeric'],
    unknown: null,
  }[t];

  return { kind: 'scalar', nullable, candidates: base, ts: t };
}
