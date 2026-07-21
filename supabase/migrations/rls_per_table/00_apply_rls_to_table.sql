-- ============================================================================
-- RLS per-table application template
-- ============================================================================
--
-- طريقة الاستخدام:
--   1. افتح الملف ده في Supabase SQL Editor
--   2. غيّر قيمة TABLE_NAME لاسم الجدول اللي عايز تفعّل عليه RLS
--   3. شغّله
--   4. اختبر بـ SELECT/INSERT/UPDATE بحساب مستخدم حقيقي
--   5. لو نجح → انتقل للجدول اللي بعده
--   6. لو فشل → DROP POLICY + ارجع لقبل ما تفعّل
--
-- ============================================================================

-- ⬇️ غيّر الاسم ده لكل جدول ⬇️
do $$
declare
  target_table text := 'properties';  -- ⬅️ غيّر ده لكل جدول جديد
begin
  -- Drop old role-based policies first (they'll be replaced)
  execute format('drop policy if exists app_read_%I on public.%I', target_table, target_table);
  execute format('drop policy if exists manager_write_%I on public.%I', target_table, target_table);

  -- Create company isolation policy
  execute format(
    'create policy %I_company_isolation on public.%I
      for all to authenticated
      using (company_id = public.current_company_id())
      with check (company_id = public.current_company_id())',
    target_table, target_table
  );

  raise notice 'RLS company isolation applied to table: %', target_table;
end;
$$;

-- ── Verification query after applying ────────────────────────────────────

-- شغّل ده بعد ما تطبّق RLS على أي جدول عشان تتأكد إنه شغال:
-- (غيّر 'properties' لاسم الجدول)

select 'RLS active' as check_type,
       (select count(*) from public.properties) as visible_rows,
       current_user as current_user;

-- لو المستخدم مربوط بالشركة الافتراضية: المفروض يشوف كل الصفوف
-- لو المستخدم مش مربوط: المفروض يشوف 0 صفوف
