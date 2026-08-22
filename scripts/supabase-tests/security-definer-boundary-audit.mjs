#!/usr/bin/env node
// Phase 5 — SECURITY DEFINER boundary audit.
//
// Replays the current migration chain into disposable PGlite and proves that
// known internal elevated helpers are still wired for their internal purpose
// but are no longer directly executable by browser roles. It also proves a
// governed user-facing SECURITY DEFINER RPC keeps its intended authenticated
// boundary, guarding against an unsafe blanket-revoke strategy.

import { createDatabase, replay, listMigrations } from '../db0/lib/replay.mjs';

const candidates = [
  {
    id: 'SD-01',
    signature: 'public.next_document_reference(uuid,text,text,integer)',
    minTriggers: 0,
  },
  {
    id: 'SD-02',
    signature: 'public.assign_document_reference()',
    minTriggers: 1,
  },
  {
    id: 'SD-03',
    signature: 'public.update_unit_status_from_activity()',
    minTriggers: 2,
  },
];

const results = [];

function record(id, title, pass, detail = '') {
  results.push({ id, title, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} ${id}  ${title}`);
  if (!pass && detail) console.log(`       ${detail}`);
}

function firstLine(error) {
  return String(error?.message ?? error).split('\n')[0].slice(0, 300);
}

async function inspectFunction(db, signature) {
  const res = await db.query(
    `select
       p.oid::text as oid,
       p.prosecdef as security_definer,
       pg_get_functiondef(p.oid) as definition,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute,
       (select count(*)::integer from pg_trigger t where not t.tgisinternal and t.tgfoid = p.oid) as trigger_count
     from pg_proc p
     where p.oid = to_regprocedure($1)`,
    [signature],
  );
  return res.rows[0] ?? null;
}

async function main() {
  const files = await listMigrations();
  const db = await createDatabase();

  try {
    const replayResult = await replay(db, { files, stopOnError: true });
    if (replayResult.failures.length > 0) {
      console.error('Migration replay failed before Phase 5 audit could run:');
      for (const failure of replayResult.failures) console.error(`  ${failure.file}: ${firstLine(failure.error)}`);
      process.exitCode = 1;
      return;
    }

    console.log(`SECURITY DEFINER boundary audit: ${files.length} migrations replayed cleanly.\n`);

    for (const candidate of candidates) {
      const row = await inspectFunction(db, candidate.signature);
      record(`${candidate.id}A`, `${candidate.signature} exists`, row !== null, row ? '' : 'function missing');
      if (!row) continue;

      record(`${candidate.id}B`, `${candidate.signature} remains SECURITY DEFINER`, row.security_definer === true, JSON.stringify(row));
      record(`${candidate.id}C`, `anon cannot EXECUTE ${candidate.signature}`, row.anon_execute === false, JSON.stringify(row));
      record(`${candidate.id}D`, `authenticated cannot EXECUTE ${candidate.signature}`, row.authenticated_execute === false, JSON.stringify(row));
      record(`${candidate.id}E`, `service_role can EXECUTE ${candidate.signature}`, row.service_execute === true, JSON.stringify(row));

      if (candidate.minTriggers > 0) {
        record(
          `${candidate.id}F`,
          `${candidate.signature} remains attached to at least ${candidate.minTriggers} trigger(s)`,
          Number(row.trigger_count) >= candidate.minTriggers,
          `trigger_count=${row.trigger_count}`,
        );
      }
    }

    const assign = await inspectFunction(db, 'public.assign_document_reference()');
    record(
      'SD-04',
      'assign_document_reference still delegates to next_document_reference',
      Boolean(assign?.definition?.includes('next_document_reference')),
      assign ? 'delegation marker missing' : 'assign_document_reference missing',
    );

    // Negative control: Phase 5 must not become a blanket SECURITY DEFINER
    // lockdown. Bank preview is a governed, browser-facing RPC and should stay
    // executable by authenticated; its Phase 4 canonical role gate decides
    // whether the caller is actually authorized.
    const preview = await inspectFunction(db, 'public.preview_bank_statement_batch_atomic(jsonb)');
    record('SD-05A', 'governed bank preview RPC exists', preview !== null, preview ? '' : 'function missing');
    if (preview) {
      record('SD-05B', 'governed bank preview remains SECURITY DEFINER', preview.security_definer === true, JSON.stringify(preview));
      record('SD-05C', 'governed bank preview remains callable by authenticated', preview.authenticated_execute === true, JSON.stringify(preview));
      record(
        'SD-05D',
        'governed bank preview still contains canonical ADMIN/MANAGER resolver path',
        preview.definition.includes('is_admin_or_manager()'),
        'canonical role-helper marker missing',
      );
    }

    const passed = results.filter((r) => r.pass).length;
    const failed = results.length - passed;
    console.log(`\nPhase 5 audit summary: ${passed} passed / ${failed} failed.`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(`Phase 5 audit crashed: ${firstLine(error)}`);
  process.exitCode = 1;
});
