// WP-DB0 — schema introspection.
//
// Produces a stable, diffable inventory of everything the data contract covers:
// tables, columns, enums, constraints, foreign keys, views, functions/RPCs,
// triggers, RLS policies, and indexes.

const Q = {
  tables: `
    select c.relname as name,
           c.relkind as kind,
           c.relrowsecurity as rls_enabled,
           c.relforcerowsecurity as rls_forced
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p')
    order by c.relname
  `,

  columns: `
    select c.table_name, c.column_name, c.ordinal_position,
           c.data_type, c.udt_name,
           c.is_nullable, c.column_default,
           c.numeric_precision, c.numeric_scale,
           c.character_maximum_length,
           c.is_identity, c.identity_generation, c.is_generated
    from information_schema.columns c
    join pg_class pc on pc.relname = c.table_name
    join pg_namespace pn on pn.oid = pc.relnamespace and pn.nspname = 'public'
    where c.table_schema = 'public' and pc.relkind in ('r','p','v','m')
    order by c.table_name, c.ordinal_position
  `,

  enums: `
    select t.typname as name,
           array_agg(e.enumlabel order by e.enumsortorder) as labels
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    group by t.typname
    order by t.typname
  `,

  constraints: `
    select rel.relname as table_name,
           con.conname as name,
           con.contype as type,
           pg_get_constraintdef(con.oid) as definition
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
    order by rel.relname, con.conname
  `,

  foreign_keys: `
    select rel.relname as table_name,
           con.conname as name,
           tgt.relname as references_table,
           pg_get_constraintdef(con.oid) as definition,
           con.confdeltype as on_delete,
           con.confupdtype as on_update
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_class tgt on tgt.oid = con.confrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public' and con.contype = 'f'
    order by rel.relname, con.conname
  `,

  views: `
    select c.relname as name,
           c.relkind as kind,
           coalesce(
             (select option_value from pg_options_to_table(c.reloptions)
              where option_name = 'security_invoker'), 'false') as security_invoker
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v','m')
    order by c.relname
  `,

  functions: `
    select p.proname as name,
           pg_get_function_identity_arguments(p.oid) as args,
           pg_get_function_result(p.oid) as returns,
           p.prosecdef as security_definer,
           p.provolatile as volatility,
           l.lanname as language,
           coalesce(array_to_string(p.proconfig, ','), '') as config,
           p.prokind as kind
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
    order by p.proname, pg_get_function_identity_arguments(p.oid)
  `,

  triggers: `
    select rel.relname as table_name,
           t.tgname as name,
           pg_get_triggerdef(t.oid) as definition
    from pg_trigger t
    join pg_class rel on rel.oid = t.tgrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public' and not t.tgisinternal
    order by rel.relname, t.tgname
  `,

  policies: `
    select schemaname, tablename, policyname as name, permissive,
           roles::text as roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname
  `,

  indexes: `
    select tablename as table_name, indexname as name, indexdef as definition
    from pg_indexes
    where schemaname = 'public'
    order by tablename, indexname
  `,

  // Single-column CHECK constraints that enumerate allowed values. These are
  // the project's de-facto enums (`status text check (status in (...))`) and
  // must survive into the generated types, otherwise the frontend loses the
  // literal unions it switches on.
  check_enums: `
    select rel.relname as table_name,
           con.conname as name,
           pg_get_constraintdef(con.oid) as definition,
           (select array_agg(att.attname)
              from unnest(con.conkey) k
              join pg_attribute att
                on att.attrelid = con.conrelid and att.attnum = k) as columns
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and con.contype = 'c'
      and array_length(con.conkey, 1) = 1
    order by rel.relname, con.conname
  `,

  grants: `
    select table_name, grantee, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon','authenticated','service_role')
    order by table_name, grantee, privilege_type
  `,

  function_grants: `
    select p.proname as name,
           pg_get_function_identity_arguments(p.oid) as args,
           a.grantee
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a_raw
    join lateral (select pg_get_userbyid(a_raw.grantee) as grantee, a_raw.privilege_type) a on true
    where n.nspname = 'public'
      and a.privilege_type = 'EXECUTE'
      and a.grantee in ('anon','authenticated','service_role')
    order by p.proname, args, a.grantee
  `,
};

export async function introspect(db) {
  const out = {};
  for (const [key, sql] of Object.entries(Q)) {
    try {
      const res = await db.query(sql);
      out[key] = res.rows;
    } catch (error) {
      out[key] = { error: String(error?.message ?? error) };
    }
  }
  return out;
}

/** Normalise a numeric column into `numeric(p,s)` shorthand for contract diffs. */
export function columnTypeSignature(col) {
  const t = col.udt_name;
  if (t === 'numeric' && col.numeric_precision != null) {
    return `numeric(${col.numeric_precision},${col.numeric_scale})`;
  }
  if ((t === 'varchar' || t === 'bpchar') && col.character_maximum_length != null) {
    return `${t}(${col.character_maximum_length})`;
  }
  return t;
}

export { Q as INTROSPECTION_QUERIES };
