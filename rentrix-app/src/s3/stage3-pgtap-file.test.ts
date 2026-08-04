/**
 * Runs supabase/tests/stage3_gl_core.sql (the release-blocker database gate
 * file) against a full PGlite replay using minimal pgTAP stubs, so the gate
 * file's SQL is syntax- and behavior-validated in the regular CI suite.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFullReplayedDatabase, repoRoot } from '../p1/replay-bootstrap';

const PGTAP_STUBS = `
create schema if not exists extensions;
create or replace function extensions.plan(n int) returns void language plpgsql as $$
begin
  perform set_config('pgtap.stub.plan', n::text, true);
end $$;
create or replace function extensions.finish() returns void language plpgsql as $$
begin
  if current_setting('pgtap.stub.failures', true) <> '' then
    raise exception 'PGTAP-STUB-FAILURES: %', current_setting('pgtap.stub.failures', true);
  end if;
end $$;
create or replace function extensions.ok(b boolean, msg text default '') returns void language plpgsql as $$
begin
  if not coalesce(b, false) then
    perform set_config('pgtap.stub.failures', coalesce(current_setting('pgtap.stub.failures', true), '') || ' [ok] ' || msg, true);
  end if;
end $$;
create or replace function extensions.is(a anyelement, b anyelement, msg text default '') returns void language plpgsql as $$
begin
  if a is distinct from b then
    perform set_config('pgtap.stub.failures', coalesce(current_setting('pgtap.stub.failures', true), '') || format(' [is] %s (got %s want %s)', msg, a, b), true);
  end if;
end $$;
create or replace function extensions.lives_ok(sql text, msg text default '') returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    perform set_config('pgtap.stub.failures', coalesce(current_setting('pgtap.stub.failures', true), '') || format(' [lives_ok] %s -> %s', msg, sqlerrm), true);
  end;
end $$;
create or replace function extensions.throws_ok(sql text, errcode text default null, errmsg text default null, msg text default '') returns void language plpgsql as $$
declare
  v_sqlstate text;
  v_message text;
begin
  begin
    execute sql;
    perform set_config('pgtap.stub.failures', coalesce(current_setting('pgtap.stub.failures', true), '') || format(' [throws_ok] %s -> did not throw', msg), true);
  exception when others then
    v_sqlstate := sqlstate;
    v_message := sqlerrm;
    if errcode is not null and errcode <> '' and v_sqlstate <> errcode then
      perform set_config('pgtap.stub.failures', coalesce(current_setting('pgtap.stub.failures', true), '') || format(' [throws_ok] %s -> sqlstate %s want %s', msg, v_sqlstate, errcode), true);
    end if;
    if errmsg is not null and errmsg <> '' and position(errmsg in v_message) = 0 then
      perform set_config('pgtap.stub.failures', coalesce(current_setting('pgtap.stub.failures', true), '') || format(' [throws_ok] %s -> msg %s want %s', msg, v_message, errmsg), true);
    end if;
  end;
end $$;
create or replace function extensions.has_table(schema text, tbl text, msg text default '') returns void language plpgsql as $$
begin
  perform extensions.ok(to_regclass(format('%I.%I', schema, tbl)) is not null, msg);
end $$;
create or replace function extensions.has_view(schema text, tbl text, msg text default '') returns void language plpgsql as $$
begin
  perform extensions.ok(
    exists (select 1 from pg_views where schemaname = schema and viewname = tbl),
    msg
  );
end $$;
`;

describe('stage3 pgTAP file stub-run', () => {
  it('runs supabase/tests/stage3_gl_core.sql against the replay', async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    const { db } = replay;
    await db.exec(PGTAP_STUBS);
    // Real Supabase ships USAGE on the extensions schema for app roles, which
    // lets the existing pgTAP files call pgTAP functions inside role blocks.
    await db.exec(`grant usage on schema extensions to anon, authenticated;`);
    const sql = readFileSync(join(repoRoot, 'supabase', 'tests', 'stage3_gl_core.sql'), 'utf8');
    // The real file runs under the pgtap extension (schema `extensions` on real
    // Supabase); on PGlite the stubs live in `extensions` — rewrite unqualified
    // pgtap calls to extensions.*
    const rewritten = sql
      .replace(/create extension if not exists pgtap with schema extensions;/g, '')
      .replace(/\b(plan|finish|ok|is|lives_ok|throws_ok|has_table|has_view)\(/g, 'extensions.$1(');
    try {
      await db.exec(rewritten);
      console.log('PGTAP-STUB: file executed without failures');
    } catch (e) {
      console.log('PGTAP-STUB FAILED:', String(e).slice(0, 800));
      throw e;
    }
    await db.close();
  }, 300_000);
});
