/**
 * Single-flight content identity for document renders.
 *
 * WHY A CONTENT DIGEST (and not a filename/date key):
 * the registry filename strategy intentionally falls back to
 * `<prefix>-<date>` whenever a document has no real business reference, so
 * two genuinely DIFFERENT documents routinely share one filename (every
 * monthly rent invoice due on the same day is `invoice-2026-07-31`). A
 * filename-only or date-only key would make a click on the second document
 * join the first document's in-flight render and silently output the WRONG
 * document. The identity therefore hashes the exact model being rendered.
 *
 * CONTRACT
 *  - Deterministic: the same logical model always yields the same key,
 *    regardless of the ORDER in which object properties were assigned.
 *  - Operation-scoped: the channel (`print` / `pdf` / `pdf-file`) is part of the key, so
 *    a print and a PDF of the same document never coalesce — they are two
 *    distinct user-visible operations producing different outputs.
 *  - Total: it can never throw. Circular references, `bigint`, `symbol`,
 *    functions, `undefined`, `NaN`/`Infinity` and exotic values are all
 *    encoded rather than crashing `JSON.stringify`. A render must never fail
 *    because of its own de-duplication key.
 *  - Opaque: the returned key carries NO document content — only the
 *    channel, the document type and fixed-width hashes. It is used solely as
 *    an in-memory `Map` key; it is never logged, written to the DOM, used in
 *    a filename, or persisted to evidence.
 */
import type { UnifiedDocumentModel } from '../types';

/** Marker emitted in place of a value that cannot be serialized directly. */
const CIRCULAR = '\u0000circular';

/**
 * Canonical, stable, total serialization.
 *
 * Object keys are sorted so `{a,b}` and `{b,a}` produce identical output —
 * property insertion order is an implementation detail of whichever builder
 * assembled the model and must not change a document's identity. Arrays keep
 * their order, because row/column order IS document content.
 */
export function canonicalSerialize(value: unknown, seen: WeakSet<object> = new WeakSet()): string {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
      // Length-prefixed so "ab"+"c" can never collide with "a"+"bc".
      return `s${value.length}:${value}`;
    case 'number':
      // `Object.is` distinguishes -0 from 0; NaN/Infinity get stable tokens.
      if (Number.isNaN(value)) return 'n:NaN';
      if (!Number.isFinite(value)) return value > 0 ? 'n:+Inf' : 'n:-Inf';
      return `n:${Object.is(value, -0) ? '-0' : String(value)}`;
    case 'boolean':
      return `b:${value}`;
    case 'undefined':
      return 'u';
    case 'bigint':
      // `JSON.stringify` throws on bigint; encode it instead.
      return `g:${value.toString()}`;
    case 'symbol':
      return `y:${value.description ?? ''}`;
    case 'function':
      // Not document content; collapse to a constant so it cannot destabilize
      // the key across renders of the same logical model.
      return 'f';
    default:
      break;
  }

  const objectValue = value as object;

  if (seen.has(objectValue)) return CIRCULAR;
  seen.add(objectValue);
  try {
    if (objectValue instanceof Date) {
      const time = objectValue.getTime();
      return `d:${Number.isNaN(time) ? 'invalid' : time}`;
    }

    if (Array.isArray(objectValue)) {
      return `a[${objectValue.map((entry) => canonicalSerialize(entry, seen)).join(',')}]`;
    }

    if (objectValue instanceof Map) {
      const entries = [...objectValue.entries()]
        .map(([key, entry]) => `${canonicalSerialize(key, seen)}=>${canonicalSerialize(entry, seen)}`)
        .sort();
      return `m{${entries.join(',')}}`;
    }

    if (objectValue instanceof Set) {
      const entries = [...objectValue.values()].map((entry) => canonicalSerialize(entry, seen)).sort();
      return `t{${entries.join(',')}}`;
    }

    // Plain object: sort keys for order-independence.
    const record = objectValue as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const body = keys.map((key) => `s${key.length}:${key}:${canonicalSerialize(record[key], seen)}`).join(',');
    return `o{${body}}`;
  } catch {
    // Exotic host/proxy objects must never break a render.
    return 'o{unserializable}';
  } finally {
    seen.delete(objectValue);
  }
}

/**
 * 64-bit-style digest built from two independent FNV-1a lanes.
 *
 * Deterministic and dependency-free. This is a de-duplication key, never a
 * security primitive; two lanes plus the input length make an accidental
 * collision between two concurrently-rendered documents effectively
 * impossible in practice.
 */
export function stableDigest(input: string): string {
  let hashA = 0x811c9dc5;
  let hashB = 0x01000193;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    hashA = Math.imul(hashA ^ code, 0x01000193) >>> 0;
    hashB = Math.imul(hashB + code + index, 0x85ebca6b) >>> 0;
    hashB = ((hashB << 13) | (hashB >>> 19)) >>> 0;
  }
  const lengthLane = (input.length >>> 0).toString(16).padStart(8, '0');
  return `${hashA.toString(16).padStart(8, '0')}${hashB.toString(16).padStart(8, '0')}${lengthLane}`;
}

export type DocumentRenderChannel = 'print' | 'pdf' | 'pdf-file';

/**
 * Operation-scoped identity for one document render.
 *
 * Only `channel` and the document `type` appear in clear text — both are
 * fixed vocabulary, not user or company data. Everything that could carry
 * document content (company identity, party names, amounts, references, and
 * the filename itself) is reduced to an opaque digest.
 */
export function documentIdentityKey(channel: DocumentRenderChannel, model: UnifiedDocumentModel): string {
  const canonical = canonicalSerialize({
    type: model.type,
    fileName: model.fileName,
    header: model.header,
    kpis: model.kpis,
    tables: model.tables,
    charts: model.charts,
    footer: model.footer,
  });
  const documentType = typeof model?.type === 'string' && /^[a-z_]{1,40}$/.test(model.type) ? model.type : 'unknown';
  return `${channel}:${documentType}:${stableDigest(canonical)}`;
}
