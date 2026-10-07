/**
 * WP-06 — single-flight content-identity contract.
 *
 * The identity function is what makes "one click, one document" safe. These
 * tests pin its exact guarantees:
 *
 *  - deterministic and INDEPENDENT of property insertion order;
 *  - operation-scoped (print and PDF never share a key);
 *  - discriminating (two different documents that share type + filename get
 *    different keys — the wrong-document bug this replaced);
 *  - total (never throws on circular data, bigint, symbols, functions,
 *    NaN/Infinity or exotic values);
 *  - opaque (the key leaks no document content).
 */
import { describe, expect, it } from 'vitest';
import { canonicalSerialize, documentIdentityKey, stableDigest } from './documentIdentity';
import type { UnifiedDocumentModel } from '../types';

const COMPANY = 'شركة الأفق لإدارة الأملاك';
const TENANT = 'أحمد بن سالم الحارثي';

const model = (overrides: Partial<UnifiedDocumentModel> = {}): UnifiedDocumentModel => ({
  type: 'invoice',
  header: { companyName: COMPANY, title: 'فاتورة مطالبة مالية', documentNo: 'INV-2026-0100' },
  kpis: [{ label: 'المستأجر', value: TENANT }],
  tables: [{ columns: ['البند', 'المبلغ'], rows: [['إيجار يوليو', '420.000 ر.ع']] }],
  footer: { signatures: ['accountant'], companyStampLabel: null, metadata: null },
  fileName: 'invoice-2026-07-31',
  ...overrides,
});

describe('canonical serialization — deterministic and order-independent', () => {
  it('produces identical output regardless of property insertion order', () => {
    const forward = { alpha: 1, beta: { gamma: 'x', delta: [1, 2] } };
    const reversed = { beta: { delta: [1, 2], gamma: 'x' }, alpha: 1 };
    expect(canonicalSerialize(forward)).toBe(canonicalSerialize(reversed));
  });

  it('preserves ARRAY order, because row and column order is document content', () => {
    expect(canonicalSerialize([1, 2])).not.toBe(canonicalSerialize([2, 1]));
    expect(canonicalSerialize(['أ', 'ب'])).not.toBe(canonicalSerialize(['ب', 'أ']));
  });

  it('cannot be fooled by string concatenation boundaries', () => {
    // Without length prefixes, {a:'b', c:''} and {a:'', c:'b'} could collide.
    expect(canonicalSerialize({ a: 'b', c: '' })).not.toBe(canonicalSerialize({ a: '', c: 'b' }));
    expect(canonicalSerialize(['ab', 'c'])).not.toBe(canonicalSerialize(['a', 'bc']));
  });

  it('distinguishes values JSON would flatten or reject', () => {
    expect(canonicalSerialize(0)).not.toBe(canonicalSerialize(-0));
    expect(canonicalSerialize(Number.NaN)).toBe('n:NaN');
    expect(canonicalSerialize(Number.POSITIVE_INFINITY)).toBe('n:+Inf');
    expect(canonicalSerialize(undefined)).not.toBe(canonicalSerialize(null));
    expect(canonicalSerialize('1')).not.toBe(canonicalSerialize(1));
  });
});

describe('totality — identity generation can never break a render', () => {
  it('survives circular references', () => {
    const circular: Record<string, unknown> = { title: 'تقرير' };
    circular.self = circular;
    circular.nested = { parent: circular };
    expect(() => canonicalSerialize(circular)).not.toThrow();
    expect(canonicalSerialize(circular)).toContain('circular');
  });

  it('survives bigint, symbol, function and Date values that JSON.stringify rejects or drops', () => {
    expect(() => JSON.stringify({ big: 10n })).toThrow(); // baseline: JSON cannot
    const exotic = {
      big: 10n,
      sym: Symbol('mark'),
      fn: () => undefined,
      when: new Date('2026-07-31T00:00:00.000Z'),
      invalidDate: new Date('nope'),
    };
    expect(() => canonicalSerialize(exotic)).not.toThrow();
    expect(canonicalSerialize(exotic)).toContain('g:10');
  });

  it('survives Map, Set and a throwing getter', () => {
    const hostile = {
      map: new Map<unknown, unknown>([['b', 2], ['a', 1]]),
      set: new Set([2, 1]),
      get boom() {
        throw new Error('hostile getter');
      },
    };
    expect(() => canonicalSerialize(hostile)).not.toThrow();
    // Map/Set entries are order-normalized, so equal content ⇒ equal output.
    expect(canonicalSerialize({ map: new Map([['a', 1], ['b', 2]]) })).toBe(
      canonicalSerialize({ map: new Map([['b', 2], ['a', 1]]) }),
    );
  });

  it('builds a key for a model carrying circular and exotic payload data', () => {
    const hostileModel = model();
    (hostileModel.header as unknown as Record<string, unknown>).cycle = hostileModel;
    expect(() => documentIdentityKey('pdf', hostileModel)).not.toThrow();
    expect(documentIdentityKey('pdf', hostileModel)).toMatch(/^pdf:invoice:[0-9a-f]{24}$/);
  });

  it('produces a well-formed key even for a malformed model', () => {
    const malformed = { type: '../../etc/passwd', fileName: null } as unknown as UnifiedDocumentModel;
    expect(documentIdentityKey('print', malformed)).toMatch(/^print:unknown:[0-9a-f]{24}$/);
  });
});

describe('digest stability', () => {
  it('is deterministic across repeated calls', () => {
    expect(stableDigest('كشف حساب مالك')).toBe(stableDigest('كشف حساب مالك'));
    expect(documentIdentityKey('pdf', model())).toBe(documentIdentityKey('pdf', model()));
  });

  it('changes when any rendered value changes', () => {
    const base = stableDigest(canonicalSerialize(model()));
    expect(stableDigest(canonicalSerialize(model({ fileName: 'invoice-2026-08-31' })))).not.toBe(base);
    expect(
      stableDigest(
        canonicalSerialize(model({ tables: [{ columns: ['البند', 'المبلغ'], rows: [['إيجار يوليو', '999.000 ر.ع']] }] })),
      ),
    ).not.toBe(base);
  });

  it('emits a fixed-width hexadecimal digest', () => {
    for (const sample of ['', 'a', 'إيصال', 'x'.repeat(5000)]) {
      expect(stableDigest(sample)).toMatch(/^[0-9a-f]{24}$/);
    }
  });
});

describe('operation scoping and discrimination', () => {
  it('print and PDF of the SAME document never share a key', () => {
    const document = model();
    expect(documentIdentityKey('print', document)).not.toBe(documentIdentityKey('pdf', document));
  });

  it('identical documents share a key per channel (double-click coalescing)', () => {
    expect(documentIdentityKey('print', model())).toBe(documentIdentityKey('print', model()));
    expect(documentIdentityKey('pdf', model())).toBe(documentIdentityKey('pdf', model()));
  });

  it('two DIFFERENT documents with the same type and filename get different keys', () => {
    // The registry falls back to `<prefix>-<date>`, so this is the real
    // production case that previously returned the wrong document.
    const first = model({ tables: [{ columns: ['البند', 'المبلغ'], rows: [['إيجار', '100.000 ر.ع']] }] });
    const second = model({ tables: [{ columns: ['البند', 'المبلغ'], rows: [['إيجار', '999.000 ر.ع']] }] });
    expect(first.type).toBe(second.type);
    expect(first.fileName).toBe(second.fileName);
    expect(documentIdentityKey('pdf', first)).not.toBe(documentIdentityKey('pdf', second));
  });

  it('a different party on an otherwise identical document changes the key', () => {
    const other = model({ kpis: [{ label: 'المستأجر', value: 'سالم بن راشد البلوشي' }] });
    expect(documentIdentityKey('print', other)).not.toBe(documentIdentityKey('print', model()));
  });

  it('is stable when the SAME model is rebuilt with a different property order', () => {
    const reordered: UnifiedDocumentModel = {
      fileName: 'invoice-2026-07-31',
      footer: { metadata: null, companyStampLabel: null, signatures: ['accountant'] },
      tables: [{ rows: [['إيجار يوليو', '420.000 ر.ع']], columns: ['البند', 'المبلغ'] }],
      kpis: [{ value: TENANT, label: 'المستأجر' }],
      header: { documentNo: 'INV-2026-0100', title: 'فاتورة مطالبة مالية', companyName: COMPANY },
      type: 'invoice',
    };
    expect(documentIdentityKey('pdf', reordered)).toBe(documentIdentityKey('pdf', model()));
  });
});

describe('the key is opaque — it must not leak document content', () => {
  it('contains only the channel, the document type and hex digests', () => {
    const key = documentIdentityKey('pdf', model());
    expect(key).toMatch(/^pdf:invoice:[0-9a-f]{24}$/);
  });

  it('never embeds company, party, amount, reference or filename text', () => {
    const key = documentIdentityKey('print', model());
    for (const secret of [COMPANY, TENANT, 'INV-2026-0100', '420.000', 'invoice-2026-07-31', 'فاتورة']) {
      expect(key).not.toContain(secret);
    }
    // Nothing Arabic (i.e. no rendered content) may appear in the key.
    expect(key).not.toMatch(/[\u0600-\u06FF]/);
  });
});
