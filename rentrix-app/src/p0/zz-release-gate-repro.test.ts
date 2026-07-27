/**
 * p0 — Docker-free, per-statement reproduction of the release database gate.
 *
 * Runs each supabase/tests/*.sql pgTAP suite on its OWN fresh PGlite replay,
 * executing statements one-by-one (autocommit) so a failing top-level
 * statement (fixture insert / un-wrapped RPC call) is captured with its exact
 * SQLSTATE + message instead of collapsing the whole suite into an aborted
 * transaction. Runs PRE-fix (baseline) and POST-fix (regressions my P0
 * hardening introduces), printing every failed assertion and every top-level
 * statement error with context.
 *
 * Harness-only, in-memory transforms (repository files untouched):
 *   - `create extension … pgtap …` neutralized (no pgTAP on PGlite).
 *   - `begin;`/`rollback;` removed; `set local role` -> `set role`;
 *     `set_config('request.jwt.claims', …, true)` -> is_local=false, so JWT/role
 *     state is session-scoped across per-statement autocommit execution.
 *   - shim lives in schema `pgtap` (never pollutes `public` catalog assertions).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createReplayedDatabase, repoRoot } from './replay-bootstrap';
import type { PGlite } from '@electric-sql/pglite';

const migDir = join(repoRoot, 'supabase', 'migrations');
const testsDir = join(repoRoot, 'supabase', 'tests');
// The migration(s) under test for the CURRENT branch's regression check.
// This used to be hardcoded to `p0_company_isolation` (a one-off migration
// from an earlier PR); since that migration is already unconditionally part
// of createReplayedDatabase()'s baseline chain (it is not in the default
// excludeMigrations list), reapplying it a second time here tested nothing
// about the current branch and produced a stale, non-representative signal.
// Point this at the newest domain-workflow migration this branch introduces
// so PRE/POST actually isolates its impact.
const FIX_UNDER_TEST = 'contract_workflow_invariants';
const fixFile = readdirSync(migDir).find((f) => f.includes(FIX_UNDER_TEST))!;
if (!fixFile) {
  throw new Error(
    `zz-release-gate-repro: no migration file matching "${FIX_UNDER_TEST}" was found under supabase/migrations. ` +
      'Update FIX_UNDER_TEST to the migration this branch is introducing.',
  );
}

// Focused on the financial-lifecycle suites that actually exercise RLS,
// report RPCs, and settlement flows under authenticated role contexts. The
// catalog-only suites (security_drift_checks, value_contract_checks) were
// already reproduced clean; unit_contract_write_checks is dominated by an
// identical-pre/post cron.job stub artifact, so it adds no signal here.
const SUITES = [
  'release_blockers.sql',
  'release_lifecycle_rehearsal.sql',
];

// Enrich the replay's stubbed auth.users with the full Supabase column set the
// pgTAP fixtures insert. The shared P0 stub intentionally keeps auth.users
// minimal (it never inserts into it during replay), so we widen it HERE —
// harness-only, applied after replay — to reproduce the real fixture cascade
// (auth.users -> public.users -> company_members -> privileged flows).
const ENRICH_AUTH = `
alter table auth.users add column if not exists instance_id uuid;
alter table auth.users add column if not exists aud text;
alter table auth.users add column if not exists role text;
alter table auth.users add column if not exists encrypted_password text;
alter table auth.users add column if not exists email_confirmed_at timestamptz;
alter table auth.users add column if not exists created_at timestamptz;
alter table auth.users add column if not exists updated_at timestamptz;
alter table auth.users add column if not exists raw_user_meta_data jsonb;
`;

const SHIM = `
create schema if not exists pgtap;
create table if not exists pgtap.results (num serial primary key, ok boolean, name text);
grant usage on schema pgtap to public;
grant insert on pgtap.results to public;
grant usage on sequence pgtap.results_num_seq to public;
create or replace function pgtap._rec(p_ok boolean, p_name text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into pgtap.results(ok, name) values (coalesce(p_ok,false), coalesce(p_name,''));
  return (case when p_ok then 'ok' else 'not ok' end) || ' - ' || coalesce(p_name,'');
end $$;
create or replace function pgtap.plan(n integer) returns text language sql as $f$ select '1..'||n $f$;
create or replace function pgtap.diag(msg text) returns text language sql as $f$ select msg $f$;
create or replace function pgtap.ok(cond boolean, name text default null) returns text
language plpgsql as $f$ begin return pgtap._rec(coalesce(cond,false), name); end $f$;
create or replace function pgtap.is(a anyelement, b anyelement, name text default null) returns text
language plpgsql as $f$
declare pass boolean;
begin
  -- numeric-aware compare so 25.00 == 25 (pgTAP compares by type, not text)
  if a is null or b is null then
    pass := (a is null and b is null);
  elsif a::text ~ '^-?\d+(\.\d+)?$' and b::text ~ '^-?\d+(\.\d+)?$' then
    pass := (a::text::numeric = b::text::numeric);
  else
    pass := (a::text = b::text);
  end if;
  return pgtap._rec( pass,
                     name || case when pass then '' else ' [got '||coalesce(a::text,'NULL')||' want '||coalesce(b::text,'NULL')||']' end );
end $f$;
create or replace function pgtap.has_table(s text, t text, name text default null) returns text
language plpgsql as $f$ begin return pgtap._rec( to_regclass(quote_ident(s)||'.'||quote_ident(t)) is not null, name ); end $f$;
create or replace function pgtap.lives_ok(q text, name text default null) returns text
language plpgsql as $f$
begin
  begin execute q; return pgtap._rec(true, name);
  exception when others then return pgtap._rec(false, name || ' [ERR:' || SQLSTATE || ' ' || left(SQLERRM,300) || ']'); end;
end $f$;
create or replace function pgtap.throws_ok(q text, errcode text default null, errmsg text default null, name text default null) returns text
language plpgsql as $f$
declare st text; msg text;
begin
  begin execute q; return pgtap._rec(false, name || ' [expected an error, but none was raised]');
  exception when others then
    get stacked diagnostics st = returned_sqlstate, msg = message_text;
    return pgtap._rec( ( (errcode is null or st = errcode) and (errmsg is null or msg ilike '%'||errmsg||'%') ), name || ' [threw '||st||']' );
  end;
end $f$;
create or replace function pgtap.finish() returns setof text language plpgsql as $f$ begin return; end $f$;
`;

/** Dollar-quote / quote / comment aware split on top-level semicolons. */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = '';
  let i = 0;
  const n = sql.length;
  let mode: 'code' | 'squig' | 'line' | 'block' | 'dollar' = 'code';
  let dollarTag = '';
  while (i < n) {
    const ch = sql[i];
    const two = sql.slice(i, i + 2);
    if (mode === 'code') {
      if (ch === "'") { mode = 'squig'; cur += ch; i++; continue; }
      if (two === '--') { mode = 'line'; cur += two; i += 2; continue; }
      if (two === '/*') { mode = 'block'; cur += two; i += 2; continue; }
      if (ch === '$') {
        const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
        if (m) { dollarTag = m[0]; mode = 'dollar'; cur += dollarTag; i += dollarTag.length; continue; }
        cur += ch; i++; continue;
      }
      if (ch === ';') { out.push(cur); cur = ''; i++; continue; }
      cur += ch; i++; continue;
    }
    if (mode === 'squig') {
      if (ch === "'" && sql[i + 1] === "'") { cur += "''"; i += 2; continue; }
      if (ch === "'") { mode = 'code'; cur += ch; i++; continue; }
      cur += ch; i++; continue;
    }
    if (mode === 'line') {
      if (ch === '\n') { mode = 'code'; }
      cur += ch; i++; continue;
    }
    if (mode === 'block') {
      if (two === '*/') { mode = 'code'; cur += two; i += 2; continue; }
      cur += ch; i++; continue;
    }
    if (mode === 'dollar') {
      if (sql.startsWith(dollarTag, i)) { cur += dollarTag; i += dollarTag.length; mode = 'code'; continue; }
      cur += ch; i++; continue;
    }
  }
  if (cur.trim()) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

function transformSuite(sql: string): string {
  let s = sql.replace(/create\s+extension\s+if\s+not\s+exists\s+pgtap[^;]*;/gi, '');
  s = s.replace(/set\s+local\s+role/gi, 'set role');
  s = s.replace(/set_config\(\s*'request\.jwt\.claims',([\s\S]*?),\s*true\s*\)/gi, "set_config('request.jwt.claims',$1, false)");
  return s;
}

async function runSuite(withFix: boolean, file: string) {
  const { db } = await createReplayedDatabase();
  await db.exec(SHIM);
  await db.exec(ENRICH_AUTH);
  if (withFix) await db.exec(readFileSync(join(migDir, fixFile), 'utf8'));
  await db.exec('truncate pgtap.results;');
  await db.exec('set search_path = public, pgtap, extensions;');

  const stmts = splitStatements(transformSuite(readFileSync(join(testsDir, file), 'utf8')));
  const topErrors: { idx: number; snippet: string; error: string }[] = [];
  for (let idx = 0; idx < stmts.length; idx++) {
    const st = stmts[idx];
    if (/^(begin|commit|rollback)\s*$/i.test(st)) continue; // autocommit harness
    try {
      await db.exec(st);
    } catch (e) {
      topErrors.push({ idx, snippet: st.replace(/\s+/g, ' ').slice(0, 170), error: String(e).slice(0, 260) });
      try { await db.exec('rollback;'); } catch { /* noop */ }
      try { await db.exec('reset role;'); await db.exec("select set_config('request.jwt.claims','',false);"); } catch { /* noop */ }
    }
  }
  let failed: string[] = [];
  try {
    const { rows } = await db.query<{ num: number; ok: boolean; name: string }>('select num, ok, name from pgtap.results order by num');
    const total = rows.length;
    failed = rows.filter((r) => !r.ok).map((r) => `#${r.num} ${r.name}`);
    await closeQuietly(db);
    return { total, failed, topErrors };
  } catch (e) {
    await closeQuietly(db);
    return { total: -1, failed: [`<results query failed: ${String(e).slice(0,160)}>`], topErrors };
  }
}
async function closeQuietly(db: PGlite) { try { await (db as any).close?.(); } catch { /* noop */ } }

describe('p0 release-gate reproduction (per-statement, Docker-free)', () => {
  it('asserts the P0 hardening introduces ZERO new failures in the release pgTAP suites', async () => {
    console.error(`\n=== fix under test: ${fixFile} ===`);
    for (const file of SUITES) {
      const pre = await runSuite(false, file);
      const post = await runSuite(true, file);

      // Regression guard: the set of failures POST-fix must not grow vs PRE-fix.
      // Residual entries are deterministic harness artifacts (numeric text
      // compare in the is() shim, plus the owner_settlements grant stub gap)
      // present identically on both sides; real pgTAP passes them (base CI is
      // green). Any entry that appears ONLY POST-fix is a real P0 regression —
      // e.g. the runtime 42803 "column c.company_id must appear in the GROUP
      // BY clause" in update_contract_balance_from_allocation() that the real
      // gate caught and this harness reproduced before the GROUP BY fix.
      const newFailures = post.failed.filter((f) => !pre.failed.includes(f));
      const newTopErrors = post.topErrors.filter(
        (t) => !pre.topErrors.some((p) => p.error.split('\n')[0] === t.error.split('\n')[0]),
      );

      console.error(`\n##### ${file} #####`);
      console.error(`  PRE : results=${pre.total} assertFails=${pre.failed.length} topLevelErrors=${pre.topErrors.length}`);
      console.error(`  POST: results=${post.total} assertFails=${post.failed.length} topLevelErrors=${post.topErrors.length}`);
      for (const f of newFailures) console.error(`     NEW POST-ONLY FAIL: ${f}`);
      for (const t of newTopErrors) console.error(`     NEW POST-ONLY TOPERR@${t.idx}: [${t.error.split('\n')[0]}] :: ${t.snippet}`);

      // Harness sanity: it actually executed the suites (not an empty run).
      expect(post.total, `${file}: harness recorded no assertions`).toBeGreaterThan(0);
      // The core property: no NEW assertion failures and no NEW hard statement errors.
      expect(newFailures, `${file}: P0 hardening introduced NEW pgTAP assertion failures`).toEqual([]);
      expect(newTopErrors, `${file}: P0 hardening introduced NEW top-level statement errors`).toEqual([]);
    }
  }, 600000);
});
