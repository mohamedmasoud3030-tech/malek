#!/usr/bin/env node
// P0-2 tax authority readiness browser boundary proof.
//
// The two authoritative tax resolvers (`resolve_active_tax_profile`,
// `resolve_active_fee_tax_treatment`) return tax_rate / tax_code / profile
// identity and take an explicit company_id, so they are service_role-only.
// A browser that called them directly got a Postgres 42501 and every tax
// readiness surface failed closed.
//
// This suite replays the live migration chain into disposable PGlite and
// proves, as the actual `anon` / `authenticated` / `service_role` roles:
//   1. the internal resolvers are still denied to the browser (no widening);
//   2. the governed wrapper `resolve_tax_authority_readiness(date[])` is
//      browser-callable and is a hardened SECURITY DEFINER function with a
//      pinned search_path;
//   3. the original P0 defect is reproduced and fixed: the internal resolver
//      raises 42501 for an authenticated member, while the wrapper returns
//      readiness for the same member and company;
//   4. the wrapper derives the company from the validated session claim
//      (it fails closed without one) and exposes no tax rate, tax code or
//      profile id.
//
// Authorization truth comes from the migration chain only. `supabase/seed.sql`
// is never applied here: it is not allowed to carry permission authority.

import { createDatabase, replay, listMigrations } from '../db0/lib/replay.mjs';

const COMPANY = '93100000-0000-4000-8000-00000000000a';
const MANAGER = '93100000-0000-4000-8000-0000000000a1';
const USER_NO_FINANCE = '93100000-0000-4000-8000-0000000000a2';
const WRAPPER = 'public.resolve_tax_authority_readiness(date[])';
const INTERNAL_RESOLVER = 'public.resolve_active_tax_profile(uuid,date)';

const results = [];
function record(id, title, pass, detail = '') {
  results.push({ id, title, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} ${id}  ${title}`);
  if (!pass && detail) console.log(`       ${detail}`);
}
function firstLine(error) {
  return String(error?.message ?? error).split('\n')[0].slice(0, 300);
}

async function hasExecute(db, role, signature) {
  const res = await db.query('select has_function_privilege($1, $2, \'EXECUTE\') as allowed', [role, signature]);
  return Boolean(res.rows[0]?.allowed);
}

async function claim(db, userId, companyId) {
  await db.query('select set_config($1, $2, false)', [
    'request.jwt.claims',
    JSON.stringify({ sub: userId, role: 'authenticated', app_metadata: companyId ? { company_id: companyId } : {} }),
  ]);
}

async function memberCompanyId(db) {
  const res = await db.query('select public.current_company_id() as company_id');
  return res.rows[0]?.company_id ?? null;
}

async function asRole(db, role, fn) {
  await db.exec(`set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}

async function main() {
  const files = await listMigrations();
  const db = await createDatabase();
  const replayResult = await replay(db, { files, stopOnError: true });
  if (replayResult.failures.length > 0) {
    console.error('Migration replay failed before tax readiness boundary proof:');
    for (const failure of replayResult.failures) {
      console.error(`  ${failure.file}: ${firstLine(failure.error)}`);
    }
    process.exit(1);
  }
  console.log(`Tax readiness browser boundary: ${files.length} migrations replayed cleanly (migration-only, no seed.sql).\n`);

  // Postgres refuses to grant to a role that does not exist.
  await db.exec('grant anon, authenticated, service_role, supabase_auth_admin to current_user;');
  await db.exec(`insert into public.companies (id, name, slug, is_active) values ('${COMPANY}', 'Boundary Co', 'boundary-co', true) on conflict (id) do nothing;`);
  await db.exec(`
    insert into auth.users (id, email, raw_app_meta_data) values
      ('${MANAGER}', 'manager@boundary.test', '{"company_id":"${COMPANY}"}'),
      ('${USER_NO_FINANCE}', 'user@boundary.test', '{"company_id":"${COMPANY}"}')
    on conflict (id) do nothing;
  `);
  await db.exec(`
    insert into public.users (id, email, name, role, status, is_active) values
      ('${MANAGER}', 'manager@boundary.test', 'Boundary Manager', 'USER', 'ACTIVE', true),
      ('${USER_NO_FINANCE}', 'user@boundary.test', 'Boundary User', 'USER', 'ACTIVE', true)
    on conflict (id) do nothing;
  `);
  await db.exec(`
    insert into public.company_members (company_id, user_id, role, is_active) values
      ('${COMPANY}', '${MANAGER}', 'MANAGER', true),
      ('${COMPANY}', '${USER_NO_FINANCE}', 'USER', true)
    on conflict (company_id, user_id) do nothing;
  `);

  // ---------------------------------------------------------------- 1. EXECUTE
  record('TAX-B-01', `anon cannot EXECUTE ${INTERNAL_RESOLVER}`, (await hasExecute(db, 'anon', INTERNAL_RESOLVER)) === false);
  record('TAX-B-02', `authenticated cannot EXECUTE ${INTERNAL_RESOLVER}`, (await hasExecute(db, 'authenticated', INTERNAL_RESOLVER)) === false);
  record('TAX-B-03', `service_role can EXECUTE ${INTERNAL_RESOLVER}`, (await hasExecute(db, 'service_role', INTERNAL_RESOLVER)) === true);
  record('TAX-B-04', 'authenticated cannot EXECUTE public.resolve_active_fee_tax_treatment(uuid,text,date)', (await hasExecute(db, 'authenticated', 'public.resolve_active_fee_tax_treatment(uuid,text,date)')) === false);
  record('TAX-B-05', `anon cannot EXECUTE ${WRAPPER}`, (await hasExecute(db, 'anon', WRAPPER)) === false);
  record('TAX-B-06', `authenticated can EXECUTE ${WRAPPER}`, (await hasExecute(db, 'authenticated', WRAPPER)) === true);
  record('TAX-B-07', `service_role can EXECUTE ${WRAPPER}`, (await hasExecute(db, 'service_role', WRAPPER)) === true);

  const wrapper = (await db.query(
    `select p.prosecdef, p.provolatile, array_to_string(p.proconfig, ',') as config,
            pg_get_function_identity_arguments(p.oid) as args,
            pg_get_function_result(p.oid) as result, pg_get_functiondef(p.oid) as definition
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'resolve_tax_authority_readiness'`,
  )).rows[0];

  record('TAX-B-08', 'wrapper is SECURITY DEFINER with a pinned search_path', wrapper?.prosecdef === true && String(wrapper?.config ?? '').includes('search_path'), `config=${wrapper?.config}`);
  record('TAX-B-09', 'wrapper argument list carries no company_id parameter', !/\bcompany_id\b/i.test(String(wrapper?.args ?? '')), `args=${wrapper?.args}`);
  record('TAX-B-10', 'wrapper result exposes no tax rate, tax code or profile id', !/\b(tax_rate|tax_code|profile_id)\b/i.test(String(wrapper?.result ?? '')), `result=${wrapper?.result}`);
  record('TAX-B-11', 'wrapper body enforces the caller identity, capability and company gates',
    /is_app_user\s*\(\s*\)/.test(wrapper?.definition ?? '')
    && /current_user_has_effective_app_permission\s*\(\s*'financial\.workspace\.view'/.test(wrapper?.definition ?? '')
    && /require_company_id\s*\(\s*\)/.test(wrapper?.definition ?? ''));

  // ------------------------------------------------- 2. The original P0 defect
  await claim(db, MANAGER, COMPANY);
  const internalCall = await asRole(db, 'authenticated', async () => {
    try {
      await db.query(`select * from public.resolve_active_tax_profile('${COMPANY}'::uuid, date '2026-09-01')`);
      return { code: null };
    } catch (error) {
      return { code: error?.code ?? null, message: firstLine(error) };
    }
  });
  record('TAX-B-12', 'authenticated browser call to the internal resolver is denied with 42501 (the P0 defect)', internalCall.code === '42501', `code=${internalCall.code} ${internalCall.message ?? ''}`);

  const wrapperRows = await asRole(db, 'authenticated', async () => {
    const res = await db.query(
      `select to_char(effective_date, 'YYYY-MM-DD') as effective_date, tax_scope, readiness_status
         from public.resolve_tax_authority_readiness(array['2026-09-01']::date[]) order by 1, 2`,
    );
    return res.rows;
  });
  record('TAX-B-13', 'the governed wrapper answers the same browser session instead (fail-closed readiness)', wrapperRows.length === 3 && wrapperRows.every((row) => ['READY', 'TAX_PROFILE_MISSING', 'FEE_TAX_TREATMENT_MISSING'].includes(row.readiness_status)), JSON.stringify(wrapperRows));
  record('TAX-B-14', 'wrapper payload carries no tax rate, tax code or profile id', !JSON.stringify(wrapperRows).match(/tax_rate|tax_code|profile_id/i));

  // ------------------------------------------------------- 3. Scope is derived
  const derivedScope = await asRole(db, 'authenticated', async () => memberCompanyId(db));
  record('TAX-B-15', 'the session company claim resolves through current_company_id()', derivedScope === COMPANY, `actual=${derivedScope}`);

  await claim(db, MANAGER, null);
  const noClaim = await asRole(db, 'authenticated', async () => {
    try {
      await db.query(`select * from public.resolve_tax_authority_readiness(array['2026-09-01']::date[])`);
      return { code: null };
    } catch (error) {
      return { code: error?.code ?? null };
    }
  });
  record('TAX-B-16', 'a member without a validated company claim fails closed', noClaim.code === '42501', `code=${noClaim.code}`);

  // ------------------------------------------------- 4. Capability gate + input
  await claim(db, USER_NO_FINANCE, COMPANY);
  const noCapability = await asRole(db, 'authenticated', async () => {
    try {
      await db.query(`select * from public.resolve_tax_authority_readiness(array['2026-09-01']::date[])`);
      return { code: null };
    } catch (error) {
      return { code: error?.code ?? null, message: firstLine(error) };
    }
  });
  record('TAX-B-17', 'a member whose role lacks financial.workspace.view is denied', noCapability.code === '42501' && String(noCapability.message ?? '').includes('TAX_READINESS_FORBIDDEN'), `code=${noCapability.code} ${noCapability.message ?? ''}`);

  await claim(db, MANAGER, COMPANY);
  const nullInput = await asRole(db, 'authenticated', async () => {
    try {
      await db.query('select * from public.resolve_tax_authority_readiness(null::date[])');
      return { code: null };
    } catch (error) {
      return { code: error?.code ?? null, message: firstLine(error) };
    }
  });
  record('TAX-B-18', 'null input is rejected with TAX_READINESS_INPUT_REQUIRED', nullInput.code === '22023' && String(nullInput.message ?? '').includes('TAX_READINESS_INPUT_REQUIRED'), `code=${nullInput.code}`);

  const emptyInput = await asRole(db, 'authenticated', async () => (await db.query("select * from public.resolve_tax_authority_readiness('{}'::date[])")).rows);
  record('TAX-B-19', 'an empty date list returns no rows instead of guessing', Array.isArray(emptyInput) && emptyInput.length === 0);

  const tooMany = await asRole(db, 'authenticated', async () => {
    try {
      await db.query('select * from public.resolve_tax_authority_readiness($1::date[])', [
        Array.from({ length: 61 }, (_, index) => `2026-${String(Math.floor(index / 28) + 9).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`),
      ]);
      return { code: null };
    } catch (error) {
      return { code: error?.code ?? null, message: firstLine(error) };
    }
  });
  record('TAX-B-20', 'an unbounded date set is rejected with TAX_READINESS_DATE_LIMIT_EXCEEDED', tooMany.code === '22023' && String(tooMany.message ?? '').includes('TAX_READINESS_DATE_LIMIT_EXCEEDED'), `code=${tooMany.code}`);

  // ------------------------------------------------------ 5. Source of authority
  // Seeded as the migration owner (setup data), then read as the browser role.
  // tax_code_catalog is global reference data (seed-owned by design, never an
  // authorization authority); supply the code the profile references so this
  // proof runs on a migrations-only database.
  await db.exec(`
    insert into public.tax_code_catalog (code, name_ar, name_en, is_active)
    values ('VAT', 'ضريبة القيمة المضافة', 'Value Added Tax', true)
    on conflict (code) do update set is_active = true;
  `);
  await db.exec(`
    insert into public.company_tax_profiles
      (company_id, version_no, tax_code, tax_rate, effective_from, effective_to, status, created_by, approved_by, approved_at)
    values
      ('${COMPANY}', 1, 'VAT', 15.0000, date '2026-01-01', date '2026-12-31', 'ACTIVE',
       '${MANAGER}', '${USER_NO_FINANCE}', now());
  `);
  await claim(db, MANAGER, COMPANY);
  const ready = await asRole(db, 'authenticated', async () => {
    const res = await db.query(
      `select readiness_status from public.resolve_tax_authority_readiness(array['2026-09-01']::date[]) where tax_scope = 'RENT'`,
    );
    return res.rows[0]?.readiness_status ?? null;
  });
  record('TAX-B-21', 'RENT readiness becomes READY once an authoritative ACTIVE profile covers the date', ready === 'READY', `actual=${ready}`);

  await db.close();

  const failed = results.filter((result) => !result.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) {
    console.log(`FAILED: ${failed.map((result) => result.id).join(', ')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Tax readiness browser boundary proof crashed:', firstLine(error));
  process.exit(1);
});
