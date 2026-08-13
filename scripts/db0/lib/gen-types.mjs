// WP-DB0 — generate `database.ts` from the replayed schema.
//
// `supabase gen types` needs a live/local database over the network, which the
// contract-freeze gate cannot depend on. This generator produces the same shape
// from the migration chain itself, so the types are a *derived artifact* of the
// migrations rather than a hand-maintained parallel truth.

import { columnTypeSignature } from './introspect.mjs';

const SCALAR = {
  bool: 'boolean',
  int2: 'number',
  int4: 'number',
  int8: 'number',
  float4: 'number',
  float8: 'number',
  numeric: 'number',
  money: 'number',
  text: 'string',
  varchar: 'string',
  bpchar: 'string',
  citext: 'string',
  uuid: 'string',
  date: 'string',
  time: 'string',
  timetz: 'string',
  timestamp: 'string',
  timestamptz: 'string',
  interval: 'string',
  inet: 'string',
  cidr: 'string',
  macaddr: 'string',
  bytea: 'string',
  json: 'Json',
  jsonb: 'Json',
  tsvector: 'string',
  tsrange: 'string',
  daterange: 'string',
  int4range: 'string',
  numrange: 'string',
  tstzrange: 'string',
  oid: 'number',
  name: 'string',
  xml: 'string',
  void: 'undefined',
  record: 'Json',
  trigger: 'unknown',
};

function pgToTs(udt, enums) {
  if (udt.startsWith('_')) {
    const inner = pgToTs(udt.slice(1), enums);
    return `${inner}[]`;
  }
  if (enums.has(udt)) {
    return enums.get(udt).map((l) => `'${l}'`).join(' | ');
  }
  return SCALAR[udt] ?? 'unknown';
}

/** Postgres type name as written in a function signature -> TS. */
function pgSignatureToTs(sig, enums) {
  let t = sig.trim().toLowerCase();
  t = t.replace(/^(in|out|inout|variadic)\s+/, '');
  const isArray = /\[\]$/.test(t);
  t = t.replace(/\[\]$/, '').trim();
  t = t.replace(/\(.*\)$/, '').trim();

  const map = {
    'character varying': 'varchar',
    character: 'bpchar',
    'timestamp with time zone': 'timestamptz',
    'timestamp without time zone': 'timestamp',
    'time with time zone': 'timetz',
    'time without time zone': 'time',
    'double precision': 'float8',
    real: 'float4',
    integer: 'int4',
    smallint: 'int2',
    bigint: 'int8',
    boolean: 'bool',
    decimal: 'numeric',
    'json': 'json',
    'jsonb': 'jsonb',
  };
  const udt = map[t] ?? t;
  const base = enums.has(udt)
    ? enums.get(udt).map((l) => `'${l}'`).join(' | ')
    : (SCALAR[udt] ?? 'unknown');
  return isArray ? `(${base})[]` : base;
}

const RESERVED = /^[A-Za-z_$][\w$]*$/;
const key = (name) => (RESERVED.test(name) ? name : `'${name}'`);

function columnTs(c, enums, checkUnions) {
  const union = checkUnions?.get(`${c.table_name}.${c.column_name}`);
  // Only narrow a textual column; a CHECK on a uuid/int column is a value
  // constraint, not a type.
  if (union && ['text', 'varchar', 'bpchar', 'citext'].includes(c.udt_name)) {
    return union.map((l) => `'${l.replace(/'/g, "\\'")}'`).join(' | ');
  }
  return pgToTs(c.udt_name, enums);
}

function rowType(columns, enums, checkUnions) {
  return columns
    .map((c) => {
      const ts = columnTs(c, enums, checkUnions);
      const nullable = c.is_nullable === 'YES';
      return `          ${key(c.column_name)}: ${ts}${nullable ? ' | null' : ''};`;
    })
    .join('\n');
}

/**
 * A column may be omitted on INSERT when it is nullable, has a default, is
 * generated, or is an identity column.
 */
function insertOptional(c) {
  return (
    c.is_nullable === 'YES' ||
    c.column_default != null ||
    c.is_identity === 'YES' ||
    c.is_generated === 'ALWAYS'
  );
}

function insertType(columns, enums, checkUnions) {
  return columns
    .filter((c) => c.is_generated !== 'ALWAYS')
    .map((c) => {
      const ts = columnTs(c, enums, checkUnions);
      const nullable = c.is_nullable === 'YES';
      const opt = insertOptional(c) ? '?' : '';
      return `          ${key(c.column_name)}${opt}: ${ts}${nullable ? ' | null' : ''};`;
    })
    .join('\n');
}

function updateType(columns, enums, checkUnions) {
  return columns
    .filter((c) => c.is_generated !== 'ALWAYS')
    .map((c) => {
      const ts = columnTs(c, enums, checkUnions);
      const nullable = c.is_nullable === 'YES';
      return `          ${key(c.column_name)}?: ${ts}${nullable ? ' | null' : ''};`;
    })
    .join('\n');
}

function relationshipIsOneToOne(tableName, columns, constraints) {
  return constraints.some((constraint) => {
    if (constraint.table_name !== tableName || !['p', 'u'].includes(constraint.type)) return false;
    const match = /(?:PRIMARY KEY|UNIQUE) \(([^)]+)\)/i.exec(constraint.definition);
    if (!match) return false;
    const uniqueColumns = match[1].split(',').map((value) => value.trim().replace(/"/g, ''));
    return uniqueColumns.length === columns.length && columns.every((column) => uniqueColumns.includes(column));
  });
}

function relationships(tableName, foreignKeys, constraints) {
  const fks = foreignKeys.filter((f) => f.table_name === tableName);
  if (!fks.length) return '        Relationships: [];';
  const items = fks
    .map((fk) => {
      const m = /FOREIGN KEY \(([^)]+)\) REFERENCES ([\w".]+)\(([^)]+)\)/i.exec(fk.definition);
      if (!m) return null;
      const cols = m[1].split(',').map((s) => s.trim().replace(/"/g, ''));
      const refCols = m[3].split(',').map((s) => s.trim().replace(/"/g, ''));
      return (
        `          {\n` +
        `            foreignKeyName: '${fk.name}';\n` +
        `            columns: [${cols.map((c) => `'${c}'`).join(', ')}];\n` +
        `            isOneToOne: ${relationshipIsOneToOne(tableName, cols, constraints)};\n` +
        `            referencedRelation: '${fk.references_table}';\n` +
        `            referencedColumns: [${refCols.map((c) => `'${c}'`).join(', ')}];\n` +
        `          },`
      );
    })
    .filter(Boolean)
    .join('\n');
  return `        Relationships: [\n${items}\n        ];`;
}

function parseArgs(argString) {
  if (!argString || !argString.trim()) return [];
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of argString) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());

  return parts.map((p) => {
    const cleaned = p.replace(/^(in|out|inout|variadic)\s+/i, '');
    const m = /^([A-Za-z_][\w$]*)\s+(.+)$/.exec(cleaned);
    if (m && !/^(character|timestamp|time|double|bit)$/i.test(m[1])) {
      return { name: m[1], type: m[2] };
    }
    return { name: null, type: cleaned };
  });
}

function functionReturnType(fn, enums, columnsByRel) {
  const ret = fn.returns.replace(/^SETOF\s+/i, '');
  const isSet = /^SETOF\s+/i.test(fn.returns);
  if (/^TABLE\(/i.test(ret)) {
    const inner = ret.slice(ret.indexOf('(') + 1, ret.lastIndexOf(')'));
    const fields = parseArgs(inner)
      .filter((field) => field.name)
      .map((field) => `${key(field.name)}: ${pgSignatureToTs(field.type, enums)} | null`)
      .join('; ');
    return `{ ${fields} }[]`;
  }
  const relationName = ret.replace(/^public\./i, '').replace(/"/g, '');
  if (columnsByRel.has(relationName)) {
    return `Database['public']['Tables']['${relationName}']['Row']${isSet ? '[]' : ''}`;
  }
  return pgSignatureToTs(ret, enums) + (isSet ? '[]' : '');
}

function functionArgFields(fn, enums) {
  const args = parseArgs(fn.args);
  const defaults = Number(fn.arg_defaults ?? 0);
  const firstOptional = Math.max(0, args.length - defaults);
  return args
    .filter((arg) => arg.name)
    .map((arg, index) => ({
      ...arg,
      optional: defaults > 0 && index >= firstOptional,
      ts: `${pgSignatureToTs(arg.type, enums)}${fn.strict ? '' : ' | null'}`,
    }));
}

function emitFunctionArgs(out, overloads, enums) {
  const variants = overloads.map((fn) => functionArgFields(fn, enums));
  if (variants.every((variant) => variant.length === 0)) {
    out.push('        Args: Record<PropertyKey, never>;');
    return;
  }

  if (variants.length === 1) {
    out.push('        Args: {');
    for (const arg of variants[0]) {
      out.push(`          ${key(arg.name)}${arg.optional ? '?' : ''}: ${arg.ts};`);
    }
    out.push('        };');
    return;
  }

  out.push('        Args:');
  for (const variant of variants) {
    if (!variant.length) {
      out.push('          | Record<PropertyKey, never>');
      continue;
    }
    out.push('          | {');
    for (const arg of variant) {
      out.push(`              ${key(arg.name)}${arg.optional ? '?' : ''}: ${arg.ts};`);
    }
    out.push('            }');
  }
  out[out.length - 1] += ';';
}

/**
 * Recover literal unions from single-column CHECK constraints of the form
 * `col = ANY (ARRAY['a'::text, 'b'::text])`. These are the project's de-facto
 * enums and the frontend switches on them, so dropping them would silently
 * widen half the domain model to `string`.
 *
 * A NOT VALID constraint is deliberately still honoured: it constrains every
 * new row, so it is part of the forward-looking write contract.
 */
export function checkEnumUnions(checkEnums = []) {
  const byColumn = new Map(); // `${table}.${column}` -> string[]
  for (const c of checkEnums) {
    const column = c.columns?.[0];
    if (!column) continue;

    // Only accept a constraint that is purely an allow-list, optionally
    // guarded by a NULL check. Anything else (ranges, cross-field rules) is
    // not an enum and must not narrow the type.
    const normalised = c.definition
      .replace(/^CHECK\s*\(+/i, '')
      .replace(/\)+$/, '')
      .replace(/\(\((\w+) IS NULL\) OR /i, '')
      .trim();

    const anyMatch = /^\(*\(?([\w".]+)\)?(?:::text)?\s*=\s*ANY\s*\(\s*\(?ARRAY\[([^\]]+)\]/i.exec(
      normalised,
    );
    if (!anyMatch) continue;
    const target = anyMatch[1].replace(/"/g, '').split('.').pop();
    if (target !== column) continue;

    const literals = [...anyMatch[2].matchAll(/'((?:[^']|'')*)'/g)].map((m) =>
      m[1].replace(/''/g, "'"),
    );
    if (!literals.length) continue;

    const key = `${c.table_name}.${column}`;
    const existing = byColumn.get(key);
    // Several CHECKs on one column: the effective domain is the intersection.
    byColumn.set(key, existing ? existing.filter((l) => literals.includes(l)) : literals);
  }
  return byColumn;
}

export function generateTypes({ schema }) {
  const enums = new Map(schema.enums.map((e) => [e.name, e.labels]));
  const checkUnions = checkEnumUnions(schema.check_enums);

  const columnsByRel = new Map();
  for (const c of schema.columns) {
    if (!columnsByRel.has(c.table_name)) columnsByRel.set(c.table_name, []);
    columnsByRel.get(c.table_name).push(c);
  }

  const out = [];
  out.push(`// AUTO-GENERATED by \`pnpm db0:gen-types\` — DO NOT EDIT BY HAND.
//
// Source of truth: the migration chain in \`supabase/migrations\`, replayed into
// a clean PostgreSQL and introspected. Regenerate after any schema change;
// \`pnpm db0:check-types\` fails the build when this file drifts from the migrations.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
`);
  out.push('export type Database = {');
  out.push('  public: {');

  // ---- Tables ---------------------------------------------------------------
  out.push('    Tables: {');
  for (const t of schema.tables) {
    const cols = columnsByRel.get(t.name) ?? [];
    out.push(`      ${key(t.name)}: {`);
    out.push('        Row: {');
    out.push(rowType(cols, enums, checkUnions));
    out.push('        };');
    out.push('        Insert: {');
    out.push(insertType(cols, enums, checkUnions));
    out.push('        };');
    out.push('        Update: {');
    out.push(updateType(cols, enums, checkUnions));
    out.push('        };');
    out.push(relationships(t.name, schema.foreign_keys, schema.constraints));
    out.push('      };');
  }
  out.push('    };');

  // ---- Views ----------------------------------------------------------------
  out.push('    Views: {');
  if (!schema.views.length) {
    out.push('      [_ in never]: never;');
  } else {
    for (const v of schema.views) {
      const cols = columnsByRel.get(v.name) ?? [];
      out.push(`      ${key(v.name)}: {`);
      out.push('        Row: {');
      out.push(rowType(cols, enums, checkUnions));
      out.push('        };');
      out.push('        Relationships: [];');
      out.push('      };');
    }
  }
  out.push('    };');

  // ---- Functions ------------------------------------------------------------
  out.push('    Functions: {');
  const callable = schema.functions.filter(
    (f) => f.returns !== 'trigger' && f.returns !== 'event_trigger' && f.kind !== 'a' && f.kind !== 'w',
  );
  const byName = new Map();
  for (const f of callable) {
    if (!byName.has(f.name)) byName.set(f.name, []);
    byName.get(f.name).push(f);
  }

  if (!byName.size) {
    out.push('      [_ in never]: never;');
  } else {
    for (const [name, overloads] of [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      // PostgREST resolves overloads by named argument sets. Preserve every
      // callable signature instead of silently selecting only one of them.
      const sorted = [...overloads].sort((a, b) => b.args.localeCompare(a.args));
      if (overloads.length > 1) {
        out.push(`      // ${overloads.length} overloads in the database; all callable signatures are preserved.`);
        for (const o of sorted) out.push(`      //   ${name}(${o.args})`);
      }
      out.push(`      ${key(name)}: {`);
      emitFunctionArgs(out, sorted, enums);
      const returnTypes = [...new Set(
        sorted.map((fn) => functionReturnType(fn, enums, columnsByRel)),
      )];
      out.push(`        Returns: ${returnTypes.join(' | ')};`);
      out.push('      };');
    }
  }
  out.push('    };');

  // ---- Enums ----------------------------------------------------------------
  out.push('    Enums: {');
  if (!schema.enums.length) {
    out.push('      [_ in never]: never;');
  } else {
    for (const e of schema.enums) {
      out.push(`      ${key(e.name)}: ${e.labels.map((l) => `'${l}'`).join(' | ')};`);
    }
  }
  out.push('    };');

  out.push('    CompositeTypes: {');
  out.push('      [_ in never]: never;');
  out.push('    };');
  out.push('  };');
  out.push('};');
  out.push('');

  // ---- Convenience aliases --------------------------------------------------
  out.push(`export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
export type Functions<T extends keyof Database['public']['Functions']> =
  Database['public']['Functions'][T];
`);

  return out.join('\n');
}

export { columnTypeSignature };
