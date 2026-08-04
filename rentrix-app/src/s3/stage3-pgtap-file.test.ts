/**
 * Runs supabase/tests/stage3_gl_core.sql (the release-blocker database gate
 * file) against a full PGlite replay using a faithful pgTAP shim, so the gate
 * file's SQL is syntax- and behavior-validated in the regular CI suite.
 *
 * The shim records assertion results in a TABLE (persistent across the
 * statement-by-statement autocommit runner), enforces plan counting, and
 * transforms `set local role` to session `set role` exactly like the repo's
 * release-gate harness (zz-rehearsal-verify), mirroring the single-transaction
 * semantics of the real `supabase test db` runner.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFullReplayedDatabase, repoRoot } from '../p1/replay-bootstrap';

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
create or replace function pgtap.ok(cond boolean, name text default null) returns text
language plpgsql as $f$ begin return pgtap._rec(coalesce(cond,false), name); end $f$;
create or replace function pgtap.is(a anyelement, b anyelement, name text default null) returns text
language plpgsql as $f$
declare pass boolean;
begin
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
create or replace function pgtap.has_view(s text, t text, name text default null) returns text
language plpgsql as $f$ begin return pgtap._rec( exists (select 1 from pg_views where schemaname = s and viewname = t), name ); end $f$;
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

describe('stage3 pgTAP gate file (faithful shim)', () => {
  it('runs supabase/tests/stage3_gl_core.sql with zero failures and a full plan', async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    const { db } = replay;
    await db.exec(SHIM);
    // Supabase local-dev default privilege parity: the Docker gate's image
    // grants broad TABLE/SEQUENCE privileges to anon/authenticated (RLS stays
    // the enforcement layer). Function EXECUTE is deliberately not re-granted.
    await db.exec(`
      grant select, insert, update, delete on all tables in schema public to anon, authenticated;
      grant usage, select on all sequences in schema public to anon, authenticated;
      grant usage on schema extensions to anon, authenticated;
    `);
    await db.exec('set search_path = public, pgtap, extensions;');
    await db.exec('truncate pgtap.results;');

    const stmts = splitStatements(transformSuite(readFileSync(join(repoRoot, 'supabase', 'tests', 'stage3_gl_core.sql'), 'utf8')));
    const topErrors: { idx: number; snippet: string; error: string }[] = [];
    for (let idx = 0; idx < stmts.length; idx++) {
      const st = stmts[idx];
      if (/^(begin|commit|rollback)\s*$/i.test(st)) continue;
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
        `=== stage3_gl_core.sql on full-chain replay ===`,
        `assertions: ${rows.length} | failed: ${failed.length} | top-level errors: ${topErrors.length}`,
        ...failed.slice(0, 20),
        ...topErrors.slice(0, 10).map((t) => `stmt#${t.idx} ${t.snippet} → ${t.error}`),
      ].join('\n'),
    );
    await replay.db.close();

    expect(topErrors, JSON.stringify(topErrors.slice(0, 5), null, 2)).toEqual([]);
    expect(failed, JSON.stringify(failed.slice(0, 10), null, 2)).toEqual([]);
    expect(rows.length).toBe(50);
  }, 420_000);
});
