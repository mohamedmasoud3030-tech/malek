#!/usr/bin/env node
// WP-DB0 probe: can the six canonical WP-01 roles actually be stored?
//
// `20260811120000_wp01_six_role_authorization_foundation.sql` adds a CHECK
// constraint permitting six roles, but `users.role` is the `user_role` ENUM.
// A CHECK constraint cannot widen an enum, so this probe determines whether
// WP-01 six-role authorization is physically representable.

import { createDatabase, replay } from './lib/replay.mjs';

const db = await createDatabase();
const { failures } = await replay(db, { stopOnError: false });
if (failures.length) {
  console.error('Migration replay failed; cannot probe.', failures);
  process.exit(2);
}

const enumLabels = (
  await db.query(`
    select e.enumlabel
    from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role' order by e.enumsortorder
  `)
).rows.map((r) => r.enumlabel);

const colType = (
  await db.query(`
    select udt_name from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'role'
  `)
).rows[0]?.udt_name;

console.log(`users.role column type : ${colType}`);
console.log(`user_role enum labels  : [${enumLabels.join(', ')}]`);

const CANONICAL = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER'];
console.log(`WP-01 canonical roles  : [${CANONICAL.join(', ')}]\n`);

const results = [];
for (const role of CANONICAL) {
  const id = crypto.randomUUID();
  try {
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${role}@db0.test`]);
    await db.query(
      `insert into public.users (id, email, name, role) values ($1, $2, $3, $4::user_role)`,
      [id, `${role}@db0.test`, role, role],
    );
    results.push({ role, stored: true, error: null });
  } catch (error) {
    results.push({ role, stored: false, error: String(error?.message ?? error).split('\n')[0] });
    try {
      await db.exec('rollback;');
    } catch {
      /* ignore */
    }
  }
}

let failed = 0;
for (const r of results) {
  if (r.stored) {
    console.log(`  STORABLE     ${r.role}`);
  } else {
    failed += 1;
    console.log(`  NOT STORABLE ${r.role}  -> ${r.error}`);
  }
}

console.log(
  `\nResult: ${CANONICAL.length - failed}/${CANONICAL.length} canonical roles are physically storable.`,
);

await db.close();
process.exit(failed ? 1 : 0);
