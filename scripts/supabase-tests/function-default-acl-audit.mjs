#!/usr/bin/env node
// Fail-closed function ACL audit.
//
// Replays every migration into disposable PGlite, then proves the security
// property that matters for future migrations: a newly-created function in
// public is NOT executable by anon/authenticated unless a migration explicitly
// grants it. This prevents accidental exposure of future SECURITY DEFINER or
// financial helper functions through permissive default privileges.

import { createDatabase, replay, listMigrations } from '../db0/lib/replay.mjs';

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
  const res = await db.query(
    `select has_function_privilege($1, $2, 'EXECUTE') as allowed`,
    [role, signature],
  );
  return Boolean(res.rows[0]?.allowed);
}

async function main() {
  const files = await listMigrations();
  const db = await createDatabase();
  const replayResult = await replay(db, { files, stopOnError: true });
  if (replayResult.failures.length > 0) {
    console.error('Migration replay failed before function ACL audit:');
    for (const failure of replayResult.failures) {
      console.error(`  ${failure.file}: ${firstLine(failure.error)}`);
    }
    process.exit(1);
  }

  console.log(`Function default ACL audit: ${files.length} migrations replayed cleanly.\n`);

  // This is the future-migration regression test. Do not add explicit grants.
  await db.exec(`
    create function public.__guardian_future_function_probe()
    returns boolean
    language sql
    stable
    as $$ select true $$;
  `);

  const anonProbe = await hasExecute(db, 'anon', 'public.__guardian_future_function_probe()');
  const authProbe = await hasExecute(db, 'authenticated', 'public.__guardian_future_function_probe()');
  record('ACL-01', 'new public functions are NOT executable by anon by default', anonProbe === false, `actual=${anonProbe}`);
  record('ACL-02', 'new public functions are NOT executable by authenticated by default', authProbe === false, `actual=${authProbe}`);

  await db.exec('drop function public.__guardian_future_function_probe();');

  const serverOnly = [
    'public.post_journal_event(jsonb)',
    'public.gl_create_journal_batch(jsonb)',
    'public.gl_post_journal_batch(uuid)',
    'public.reverse_journal_batch(uuid)',
    'public.guard_bank_reconciliation_match_integrity()',
  ];

  let caseNo = 3;
  for (const signature of serverOnly) {
    const anon = await hasExecute(db, 'anon', signature);
    const authenticated = await hasExecute(db, 'authenticated', signature);
    const service = await hasExecute(db, 'service_role', signature);
    record(`ACL-${String(caseNo++).padStart(2, '0')}`, `anon cannot EXECUTE ${signature}`, anon === false, `actual=${anon}`);
    record(`ACL-${String(caseNo++).padStart(2, '0')}`, `authenticated cannot EXECUTE ${signature}`, authenticated === false, `actual=${authenticated}`);
    record(`ACL-${String(caseNo++).padStart(2, '0')}`, `service_role can EXECUTE ${signature}`, service === true, `actual=${service}`);
  }

  // current_user inside SECURITY DEFINER resolves to the function owner, not the
  // caller. Any function that contains a caller-looking current_user guard must
  // therefore be protected independently by ACL. We fail only if such an
  // illusory guard is paired with browser EXECUTE; the ACL is the real boundary.
  const suspicious = await db.query(`
    select
      p.oid::regprocedure::text as signature,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and pg_get_functiondef(p.oid) ~* 'current_user'
      and pg_get_functiondef(p.oid) ~* '(postgres|supabase_admin|service_role)'
    order by p.oid::regprocedure::text
  `);

  const exposedSuspicious = suspicious.rows.filter(
    (row) => row.anon_execute === true || row.authenticated_execute === true,
  );
  record(
    `ACL-${String(caseNo++).padStart(2, '0')}`,
    'no browser-executable SECURITY DEFINER relies on current_user as caller identity',
    exposedSuspicious.length === 0,
    exposedSuspicious.map((row) => row.signature).join(', '),
  );

  if (suspicious.rows.length > 0) {
    console.log(`\n  INFO: ${suspicious.rows.length} SECURITY DEFINER function(s) still contain owner-identity current_user text; their browser EXECUTE boundary is independently closed.`);
  }

  const failed = results.filter((result) => !result.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`Function default ACL audit crashed: ${firstLine(error)}`);
  process.exit(1);
});
