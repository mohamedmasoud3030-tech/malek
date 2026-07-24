/**
 * P1 — Docker-free verification of the evolved release-lifecycle pgTAP suite.
 *
 * The authoritative gate (release-blocker-database CI job) runs supabase/tests/
 * release_lifecycle_rehearsal.sql via `supabase test db` after applying every
 * migration. Locally we cannot run Docker, so this suite executes the REAL
 * suite file through the P1 full-chain replay (migrations incl. P0+P1) with a
 * pgTAP shim, mirroring the P0 release-gate repro harness semantics:
 * per-statement autocommit, session-scoped JWT/role, numeric-typed `is` compare.
 *
 * It asserts the evolved fixture yields ZERO failing assertions and ZERO
 * top-level statement errors — i.e. the server-derived settlement tuple
 * (750 / 75 / 50 / 0 / 625) holds on the exact code CI will run.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFullReplayedDatabase, repoRoot } from './replay-bootstrap';
import type { PGlite } from '@electric-sql/pglite';

const SUITE = 'release_lifecycle_rehearsal.sql';

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
  elsif a::text ~ '^-?\\d+(\\.\\d+)?$' and b::text ~ '^-?\\d+(\\.\\d+)?$' then
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

async function closeQuietly(db: PGlite) { try { await (db as any).close?.(); } catch { /* noop */ } }

describe('p1 release rehearsal verification (full-chain replay: P0+P1 applied)', () => {
  it(`produces ZERO failing assertions in ${SUITE} with server-derived settlement amounts`, async () => {
    const { db, failed: migFailures } = await createFullReplayedDatabase();
    expect(migFailures, JSON.stringify(migFailures).slice(0, 500)).toEqual([]);

    await db.exec(SHIM);
    await db.exec(ENRICH_AUTH);
    // Supabase-local-dev default privilege parity (harness-only, this gate
    // only): the Docker `supabase test db` image grants broad table/sequence/
    // function privileges to `authenticated` and enforces access with RLS
    // (see security_drift_checks.sql: "Supabase grants broad table privileges
    // and relies on RLS as the enforcement layer"). The raw migration replay
    // alone never GRANTs `owner_settlements` to authenticated, so the suite's
    // own payload subselects (e.g. jsonb_build_object('settlement_id',
    //   (select id from public.owner_settlements ...)))
    // fail with plain 42501 ACL errors HERE but not in the Docker gate
    // (proven on #1276: the same assertions pass there). Probe evidence:
    // src/p1 probes — approve/pay RPCs themselves work perfectly as
    // `authenticated` (SECURITY DEFINER); identical posture pre/post P1.
    // RLS (incl. the P0 RESTRICTIVE policies) remains the enforcement layer.
    await db.exec(`
      grant select, insert, update, delete on all tables in schema public to authenticated;
      grant usage, select on all sequences in schema public to authenticated;
      grant execute on all functions in schema public to authenticated;
    `);
    await db.exec('truncate pgtap.results;');
    await db.exec('set search_path = public, pgtap, extensions;');

    const stmts = splitStatements(transformSuite(readFileSync(join(repoRoot, 'supabase', 'tests', SUITE), 'utf8')));
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

    const { rows } = await db.query<{ num: number; ok: boolean; name: string }>('select num, ok, name from pgtap.results order by num');
    const failed = rows.filter((r) => !r.ok).map((r) => `#${r.num} ${r.name}`);
    console.error(
      [
        `=== ${SUITE} on full-chain replay (P0+P1) ===`,
        `assertions: ${rows.length} | failed: ${failed.length} | top-level errors: ${topErrors.length}`,
        ...failed.slice(0, 20),
        ...topErrors.slice(0, 10).map((t) => `stmt#${t.idx} ${t.snippet} → ${t.error}`),
      ].join('\n'),
    );
    await closeQuietly(db);

    expect(topErrors, JSON.stringify(topErrors.slice(0, 5), null, 2)).toEqual([]);
    expect(failed, JSON.stringify(failed.slice(0, 10), null, 2)).toEqual([]);
    expect(rows.length).toBe(65);
  }, 420_000);
});
