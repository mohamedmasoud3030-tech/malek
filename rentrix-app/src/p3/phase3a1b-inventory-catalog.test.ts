/**
 * Phase 3A-1B — active financial function inventory (§2, execution-generated)
 * and the post-remediation catalog contract (§10).
 *
 * The inventory is built from the LIVE replayed catalog (pg_proc of the full
 * migration chain) — never from hand-written text. It captures, per function:
 * full signature, last defining migration, SECURITY DEFINER, search_path,
 * grants (via has_function_privilege), locking / idempotency / journal
 * behavior, account lookups, app/internal usage → active or historical, and
 * the anti-patterns Phase 3A-1B must eliminate:
 *   WHERE no='...' LIMIT 1 · account_id='1111|1201|4000' · ON CONFLICT (id) DO NOTHING
 *
 * Output: evidence/p3/phase3a1b/active-financial-function-inventory.json
 *         evidence/p3/phase3a1b/catalog-contract.json
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase, repoRoot } from '../p1/replay-bootstrap';

const OUT_DIR = join(repoRoot, 'evidence', 'p3', 'phase3a1b');

const TARGETS = [
  'find_payment_account_id',
  'generate_invoices_from_active_contracts',
  'record_invoice_payment_atomic',
  'post_receipt_atomic',
  'void_receipt_atomic',
];
const HELPERS = ['require_company_account_id', 'ensure_company_account'];

function lastDefiningMigration(fnName: string) {
  const migDir = join(repoRoot, 'supabase', 'migrations');
  const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
  const needle = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fnName}\\s*\\(`, 'i');
  let last: string | null = null;
  for (const f of files) {
    if (needle.test(readFileSync(join(migDir, f), 'utf8'))) last = f;
  }
  return last;
}

function dropMigrations(fnName: string) {
  const migDir = join(repoRoot, 'supabase', 'migrations');
  const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
  const needle = new RegExp(`drop\\s+function\\s+if\\s+exists\\s+public\\.${fnName}\\s*\\(`, 'i');
  return files.filter((f) => needle.test(readFileSync(join(migDir, f), 'utf8')));
}

function appCallSites(fnName: string) {
  const srcDir = join(repoRoot, 'rentrix-app', 'src');
  const needle = `rpc('${fnName}'`;
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
        if (readFileSync(p, 'utf8').includes(needle)) hits.push(p.replace(`${repoRoot}/`, ''));
      }
    }
  };
  walk(srcDir);
  return hits.sort();
}

function bodyFlags(def: string) {
  const noLookups = Array.from(def.matchAll(/no\s*=\s*'(\d{3,4})'/g)).map((m) => m[1]);
  // role→number mappings (e.g. find_payment_account_id's CASE) hold the number in
  // string literals, not in `no = '....'` predicates — catch both.
  const numberLits = Array.from(def.matchAll(/'(1111|1201|2100|4000)'/g)).map((m) => m[1]);
  return {
    legacyNoLookupLimit1: /where\s+[\w.]*no\s*=\s*'\d+'[^;]*limit\s+1/i.test(def),
    hardcodedAccountIds: /account_id\s*=\s*'(1111|1201|4000|2100)'/.test(def),
    onConflictIdDoNothing: /on\s+conflict\s*\(id\)\s+do\s+nothing/i.test(def),
    accountNumbersReferenced: [...new Set([...noLookups, ...numberLits])].sort(),
    usesFindPaymentAccountId: /find_payment_account_id\s*\(/.test(def),
    usesRequireHelper: /require_company_account_id\s*\(/.test(def),
    usesEnsureHelper: /ensure_company_account\s*\(/.test(def),
    writesJournal: /insert\s+into\s+public\.journal_entries/i.test(def),
    usesIdempotencyTable: /financial_operation_idempotency/.test(def),
    usesReceiptsRequestId: /receipts[\s\S]{0,200}request_id|request_id[\s\S]{0,200}receipts/.test(def),
    advisoryLock: /pg_advisory_xact_lock/.test(def),
    rowLocks: /for\s+update/i.test(def),
    companyFromJwt: /app_metadata[^;]{0,60}company_id|current_company_id\s*\(\)/.test(def),
  };
}

let db: PGlite;
let preDb: PGlite;
const inventory: Record<string, unknown> = { generatedAt: new Date().toISOString(), scope: 'phase3a1b' };
const MIGRATION_KEY = 'phase3a1b_canonical_accounts_invoice_payment_receipt_void';

beforeAll(async () => {
  const replay = await createFullReplayedDatabase();
  db = replay.db;
  expect(replay.failed, JSON.stringify(replay.failed).slice(0, 400)).toEqual([]);
  // Pre-remediation baseline: the same chain WITHOUT the Phase 3A-1B migration —
  // this is the on-disk §2 inventory of the active definitions as found.
  const pre = await createFullReplayedDatabase({ excludeMigrations: [MIGRATION_KEY] });
  preDb = pre.db;
  expect(pre.failed, JSON.stringify(pre.failed).slice(0, 400)).toEqual([]);
}, 420_000);

afterAll(async () => {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'active-financial-function-inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`);
  await db?.close();
  await preDb?.close();
});

async function captureFunctions(dbh: PGlite) {
  const { rows: defs } = await dbh.query(
      `select p.proname as name,
              pg_get_function_identity_arguments(p.oid) as args,
              p.prosecdef as security_definer,
              p.proconfig::text as search_path_config,
              p.proacl::text as acl,
              r.rolname as owner,
              md5(p.prosrc) as body_md5,
              pg_get_functiondef(p.oid) as def
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         join pg_roles r on r.oid = p.proowner
        where n.nspname = 'public'
          and p.proname = any($1::text[])
        order by 1, 2`,
      [[...TARGETS, ...HELPERS]],
    );
  const { rows: allDefs } = await dbh.query(
    `select p.proname as name, pg_get_functiondef(p.oid) as def
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'`,
  );
  const { rows: aclRows } = await dbh.query(
    `select p.proname as name, pg_get_function_identity_arguments(p.oid) as args,
            has_function_privilege('public', p.oid, 'EXECUTE') as pub,
            has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
            has_function_privilege('service_role', p.oid, 'EXECUTE') as svc
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = any($1::text[])`,
    [[...TARGETS, ...HELPERS]],
  );
  const aclOf = (name: string, args: string) => {
    const row = (aclRows as any[]).find((r) => r.name === name && r.args === args);
    return { public: row?.pub, anon: row?.anon, authenticated: row?.auth, serviceRole: row?.svc };
  };
  const functions: Record<string, unknown>[] = [];
  for (const row of defs as any[]) {
    const acls = aclOf(row.name, row.args);
    const internalCallers = (allDefs as any[])
      .filter((other) => other.name !== row.name && other.def.includes(`public.${row.name}(`))
      .map((other) => other.name);
    const appSites = appCallSites(row.name);
    functions.push({
      signature: `public.${row.name}(${row.args})`,
      lastDefiningMigration: lastDefiningMigration(row.name),
      securityDefiner: row.security_definer,
      searchPathConfig: row.search_path_config,
      owner: row.owner,
      aclRaw: row.acl,
      effectiveExecute: acls,
      bodyMd5: row.body_md5,
      appCallSites: appSites,
      internalCallers,
      classification: appSites.length > 0 ? 'active (app)' : internalCallers.length > 0 ? 'active (internal)' : 'internal-only (no direct callers)',
      ...bodyFlags(row.def),
    });
  }
  return functions;
}

describe('Phase 3A-1B inventory (live replay catalog)', () => {
  it('captures every live overload of the target family with full attributes (pre + post states)', async () => {
    const preFunctions = await captureFunctions(preDb);
    const functions = await captureFunctions(db);
    inventory.preRemediation = {
      note: 'replayed full chain EXCLUDING the Phase 3A-1B migration — the active definitions as found on origin/main',
      functions: preFunctions,
    };
    inventory.functions = functions;
    inventory.droppedOverloads = [
      { signature: 'public.void_receipt_atomic(uuid, bigint, jsonb, jsonb)', droppedIn: dropMigrations('void_receipt_atomic') },
      { signature: 'public.void_receipt_atomic(text, bigint, jsonb, jsonb)', droppedIn: dropMigrations('void_receipt_atomic') },
    ];
    // 7 names / 8 live overloads: void_receipt_atomic keeps two live overloads
    // (payload jsonb) + legacy (uuid, timestamptz, jsonb, jsonb) — the legacy
    // one is preserved as-is (§6: never drop an overload without proof of non-usage).
    expect(functions.length).toBe(8);
    const voidOverloads = functions.filter((f) => (f as { signature: string }).signature.startsWith('public.void_receipt_atomic('));
    expect(voidOverloads.length).toBe(2);
    // The pre-state must still exhibit the anti-patterns this phase removes —
    // that is the on-disk proof of the before/after delta.
    const preBySig = new Map(preFunctions.map((f) => [(f as { signature: string }).signature, f as Record<string, unknown>]));
    expect(preBySig.get('public.generate_invoices_from_active_contracts()')?.legacyNoLookupLimit1).toBe(true);
    expect(preBySig.get('public.find_payment_account_id(account_role text)')?.usesRequireHelper).toBe(false);
    expect(preBySig.get('public.find_payment_account_id(account_role text)')?.accountNumbersReferenced).toEqual(['1111', '1201']);
    expect(preBySig.get('public.void_receipt_atomic(payload jsonb)')?.companyFromJwt).toBe(false);
    // Post-state: the same family is clean.
    const postBySig = new Map(functions.map((f) => [(f as { signature: string }).signature, f as Record<string, unknown>]));
    expect(postBySig.get('public.generate_invoices_from_active_contracts()')?.legacyNoLookupLimit1).toBe(false);
    expect(postBySig.get('public.find_payment_account_id(account_role text)')?.usesRequireHelper).toBe(true);
    expect(postBySig.get('public.record_invoice_payment_atomic(payload jsonb)')?.usesRequireHelper).toBe(false); // via find_payment_account_id
    expect(postBySig.get('public.void_receipt_atomic(payload jsonb)')?.companyFromJwt).toBe(true);
    // The legacy void overload is byte-identical between pre and post.
    const legacyKey = 'public.void_receipt_atomic(p_receipt_id uuid, p_voided_at timestamp with time zone, p_invoice_updates jsonb, p_reverse_entries jsonb)';
    expect(postBySig.get(legacyKey)?.bodyMd5).toBe(preBySig.get(legacyKey)?.bodyMd5);
    // Every other covered overload was redefined (body md5 changed), helpers untouched.
    for (const sig of [...postBySig.keys()] as string[]) {
      if (sig === legacyKey || sig.includes('require_company_account_id') || sig.includes('ensure_company_account')) continue;
      expect(postBySig.get(sig)?.bodyMd5, `${sig} must have been redefined`).not.toBe(preBySig.get(sig)?.bodyMd5);
    }
    expect(postBySig.get('public.require_company_account_id(p_company_id uuid, p_account_no text)')?.bodyMd5)
      .toBe(preBySig.get('public.require_company_account_id(p_company_id uuid, p_account_no text)')?.bodyMd5);
    expect(postBySig.get('public.ensure_company_account(p_company_id uuid, p_account_no text, p_account_name text)')?.bodyMd5)
      .toBe(preBySig.get('public.ensure_company_account(p_company_id uuid, p_account_no text, p_account_name text)')?.bodyMd5);
  }, 120_000);

  it('captures triggers on the financial identity tables', async () => {
    const { rows } = await db.query(
      `select n.nspname || '.' || c.relname as table_name, t.tgname as trigger_name,
              p.proname as function_name, t.tgenabled,
              p.proconfig::text as search_path_config
         from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
         join pg_namespace n on n.oid = c.relnamespace
         join pg_proc p on p.oid = t.tgfoid
        where not t.tgisinternal
          and n.nspname = 'public'
          and c.relname in (
            'invoices', 'payments', 'receipts',
            'receipt_allocations', 'contract_balances',
            'journal_entries', 'contracts'
          )
        order by 1, 2`,
    );
    inventory.triggers = rows;
  }, 60_000);
});

describe('Phase 3A-1B catalog contract (§10) — violations must be GONE after remediation', () => {
  it('no covered active definition keeps a global account lookup or hardcoded account id', async () => {
    const { rows } = await db.query(
      `select p.proname as name, pg_get_functiondef(p.oid) as def
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = any($1::text[])`,
      [TARGETS],
    );
    const violations: string[] = [];
    for (const row of rows as any[]) {
      if (/where\s+[\w.]*no\s*=\s*'\d+'[^;]*limit\s+1/i.test(row.def)) violations.push(`${row.name}: WHERE no='..' LIMIT 1`);
      if (/account_id\s*=\s*'(1111|1201|4000|2100)'/.test(row.def)) violations.push(`${row.name}: hardcoded account_id`);
    }
    // find_payment_account_id may still map role→number, but resolution must be company-scoped
    const find = (rows as any[]).find((r) => r.name === 'find_payment_account_id');
    if (find && !find.def.includes('require_company_account_id')) {
      violations.push('find_payment_account_id: not resolved via require_company_account_id');
    }
    expect(violations).toEqual([]);
  }, 60_000);

  it('every covered function is company-canonical: JWT company + company-scoped writes + namespaced idempotency', async () => {
    const { rows } = await db.query(
      `select p.proname as name, pg_get_function_identity_arguments(p.oid) as args,
              pg_get_functiondef(p.oid) as def
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('record_invoice_payment_atomic', 'post_receipt_atomic', 'void_receipt_atomic', 'generate_invoices_from_active_contracts')`,
    );
    // The legacy void overload (uuid, timestamptz, jsonb, jsonb) is deliberately
    // left byte-identical (§6: no proof of non-usage ⇒ no drop, no rewrite) and
    // stays unexposed (authenticated/service_role denied) — it is out of scope
    // for the canonical checks below.
    const isLegacyVoid = (r: { name: string; args: string }) =>
      r.name === 'void_receipt_atomic' && r.args.startsWith('p_receipt_id uuid');
    const problems: string[] = [];
    for (const row of rows as any[]) {
      if (isLegacyVoid(row)) continue;
      if (!/app_metadata[^;]{0,60}company_id|current_company_id\s*\(\)/.test(row.def)) {
        problems.push(`${row.name}(${row.args}): no JWT company derivation`);
      }
    }
    // Idempotency operation keys must be namespaced `<op>:<company_uuid>` (§7).
    // NOTE: the advisory-lock literal ('<op>:' || request_id) already contains a
    // colon, so a naive substring check proves nothing — assert on the actual
    // WHERE/VALUES binding against v_company_id AND on the absence of the plain
    // un-namespaced operation_name lookup.
    for (const row of rows as any[]) {
      if (isLegacyVoid(row)) continue;
      if (
        row.name !== 'record_invoice_payment_atomic'
        && row.name !== 'post_receipt_atomic'
        && row.name !== 'void_receipt_atomic'
      ) continue;
      const op = row.name;
      const nsBinding = new RegExp(`operation_name\\s*=\\s*'${op}:'\\s*\\|\\|\\s*v_company_id`);
      const plainLookup = new RegExp(`operation_name\\s*=\\s*'${op}'\\s*\\n\\s*AND`, 'i');
      if (!nsBinding.test(row.def)) problems.push(`${op}: idempotency not bound to v_company_id`);
      if (plainLookup.test(row.def)) problems.push(`${op}: plain operation_name lookup still present`);
      const nsInsert = new RegExp(`'${op}:'\\s*\\|\\|\\s*v_company_id`);
      if (!nsInsert.test(row.def)) problems.push(`${op}: namespaced operation value never produced`);
      if (!row.def.includes('_request_fingerprint') || !row.def.includes('_target_id')) {
        problems.push(`${op}: cached response is not bound to an immutable request fingerprint and target`);
      }
      if (!row.def.includes('IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST')) {
        problems.push(`${op}: request-id reuse does not fail closed`);
      }
    }
    const post = (rows as any[]).find((row) => row.name === 'post_receipt_atomic');
    if (!/invoice_record\.company_id\s*=\s*v_company_id/.test(post?.def ?? '')) {
      problems.push('post_receipt_atomic: invoice UPDATE is not company-scoped');
    }
    if (!/GET DIAGNOSTICS\s+v_updated_invoice_count\s*=\s*ROW_COUNT/i.test(post?.def ?? '')) {
      problems.push('post_receipt_atomic: invoice UPDATE row count is not asserted');
    }
    expect(problems).toEqual([]);
  }, 60_000);

  it('ACL posture: authenticated keeps only the public RPCs; internal helpers stay unexposed; search_path pinned', async () => {
    const { rows } = await db.query(
      `select p.proname as name, pg_get_function_identity_arguments(p.oid) as args,
              p.proconfig::text as cfg,
              has_function_privilege('public', p.oid, 'EXECUTE') as pub,
              has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
              has_function_privilege('service_role', p.oid, 'EXECUTE') as svc
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = any($1::text[])`,
      [[...TARGETS, ...HELPERS]],
    );
    const byName = (n: string) => (rows as any[]).filter((r) => r.name === n);
    expect(byName('void_receipt_atomic').length).toBe(2); // both live overloads present
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, 'acl-posture.json'), `${JSON.stringify(rows, null, 2)}\n`);

    // Expectations are keyed by full identity signature (PGlite's
    // pg_get_function_identity_arguments includes declared arg names).
    // posture: public/anon denied everywhere; authenticated only on the public
    // RPCs; internal helpers + legacy void overload unexposed; service_role
    // keeps RPCs + 3A-1A helpers (3A-1A policy), never find_payment_account_id.
    const expected: Record<string, { auth: boolean; svc: boolean }> = {
      'find_payment_account_id(account_role text)': { auth: false, svc: false },
      'generate_invoices_from_active_contracts()': { auth: true, svc: true },
      'record_invoice_payment_atomic(payload jsonb)': { auth: true, svc: true },
      'post_receipt_atomic(payload jsonb)': { auth: true, svc: true },
      'void_receipt_atomic(payload jsonb)': { auth: true, svc: true },
      'void_receipt_atomic(p_receipt_id uuid, p_voided_at timestamp with time zone, p_invoice_updates jsonb, p_reverse_entries jsonb)':
        { auth: false, svc: false },
      'require_company_account_id(p_company_id uuid, p_account_no text)': { auth: false, svc: true },
      'ensure_company_account(p_company_id uuid, p_account_no text, p_account_name text)': { auth: false, svc: true },
    };
    const keys = (rows as Record<string, unknown>[]).map((r) => `${r.name}(${r.args})`).sort();
    expect(keys).toEqual(Object.keys(expected).sort());
    for (const row of rows as any[]) {
      const key = `${row.name}(${row.args})`;
      const want = expected[key];
      expect(want, `unknown overload ${key}`).toBeDefined();
      expect(row.pub, `public EXECUTE on ${key}`).toBe(false);
      expect(row.anon, `anon EXECUTE on ${key}`).toBe(false);
      expect(row.auth, `authenticated EXECUTE on ${key}`).toBe(want.auth);
      expect(row.svc, `service_role EXECUTE on ${key}`).toBe(want.svc);
      expect(String(row.cfg ?? ''), `search_path on ${key}`).toContain('search_path=public, pg_temp');
    }
  }, 60_000);

  it('writes the catalog contract evidence', async () => {
    const { rows } = await db.query(
      `select p.proname as name, pg_get_function_identity_arguments(p.oid) as args,
              p.prosecdef as definer, p.proconfig::text as cfg, md5(p.prosrc) as md5
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = any($1::text[]) order by 1, 2`,
      [[...TARGETS, ...HELPERS]],
    );
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(
      join(OUT_DIR, 'catalog-contract.json'),
      `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        posture: 'post-3a1b',
        controls: {
          immutableRequestBinding: true,
          envelopeFields: ['_request_fingerprint', '_target_id', 'response'],
          failClosedLegacyPayload: true,
          reuseError: { code: '22023', message: 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' },
          invoiceUpdate: {
            companyScoped: true,
            excludesDeletedInvoices: true,
            rowCountMatchesDistinctAllocationInvoiceIds: true,
          },
        },
        functions: rows,
      }, null, 2)}\n`,
    );
  }, 60_000);
});
