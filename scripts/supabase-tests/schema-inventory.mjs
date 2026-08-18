#!/usr/bin/env node
// One-shot PGlite inventory used by the query/schema audit. Not a hosted probe.
import { createDatabase, replay } from '../db0/lib/replay.mjs';
import { introspect } from '../db0/lib/introspect.mjs';

const UNINDEXED_FK_SQL = `
  select
    n.nspname as schema_name,
    rel.relname as table_name,
    con.conname as constraint_name,
    tgt.relname as referenced_table,
    pg_get_constraintdef(con.oid) as definition
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  join pg_class tgt on tgt.oid = con.confrelid
  where n.nspname = 'public'
    and con.contype = 'f'
    and not exists (
      select 1
        from pg_index i
       where i.indrelid = con.conrelid
         and i.indisvalid
         and (
           i.indkey::int2[] @> con.conkey
           or (array_length(con.conkey, 1) = 1 and i.indkey[0] = con.conkey[1])
         )
    )
  order by rel.relname, con.conname
`;

const db = await createDatabase();
const replayed = await replay(db, { stopOnError: false });
if (replayed.failures.length) {
  console.error(`Migration replay failed (${replayed.failures.length}).`);
  for (const failure of replayed.failures.slice(0, 8)) {
    console.error(`  ${failure.file}: ${failure.error}`);
  }
  process.exit(2);
}

const schema = await introspect(db);
const unindexed = (await db.query(UNINDEXED_FK_SQL)).rows;
const rlsOff = (schema.tables ?? []).filter((table) => !table.rls_enabled).map((table) => table.name);
const tenantTables = (schema.tables ?? []).filter((table) =>
  (schema.columns ?? []).some((column) => column.table_name === table.name && column.column_name === 'company_id'),
);

const inventory = {
  migrationsApplied: replayed.applied.length,
  tables: (schema.tables ?? []).length,
  views: (schema.views ?? []).length,
  functions: (schema.functions ?? []).length,
  policies: (schema.policies ?? []).length,
  foreignKeys: (schema.foreign_keys ?? []).length,
  indexes: (schema.indexes ?? []).length,
  rlsDisabled: rlsOff,
  tenantTableCount: tenantTables.length,
  tableNames: (schema.tables ?? []).map((table) => table.name),
  views: (schema.views ?? []).map((view) => ({ name: view.name, security_invoker: view.security_invoker })),
  unindexedForeignKeys: unindexed,
};

console.log(JSON.stringify(inventory, null, 2));
await db.close();
