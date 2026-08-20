-- ============================================================================
-- INVENTORY QUERY — شغّل ده في Supabase SQL Editor واديني النتيجة
-- ============================================================================
-- يرجع كل الجداول في public schema + عدد الصفوف + هل عليه RLS + هل فيه company_id

select
  t.table_name,
  coalesce(s.n_live_tup, 0) as estimated_rows,
  t.table_type,
  case when c.relrowsecurity then 'YES' else 'no' end as rls_enabled,
  case when exists (
    select 1 from information_schema.columns c2
    where c2.table_schema = 'public'
      and c2.table_name = t.table_name
      and c2.column_name = 'company_id'
  ) then 'YES' else 'no' end as has_company_id
from information_schema.tables t
left join pg_stat_user_tables s on s.relname = t.table_name
left join pg_class c on c.relname = t.table_name
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
order by t.table_name;
