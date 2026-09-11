begin;

insert into public.contract_inspection_templates (
  company_id, code, kind, title_ar, version_no, checklist_definition,
  is_system_default, effective_from
) values
  (null, 'SYSTEM_MOVE_IN', 'MOVE_IN', 'فحص وتسليم الوحدة عند الدخول', 1,
   '[{"code":"general_condition","label_ar":"الحالة العامة","required":true},{"code":"walls_ceiling","label_ar":"الجدران والأسقف","required":true},{"code":"floors","label_ar":"الأرضيات","required":true},{"code":"doors_windows_locks","label_ar":"الأبواب والنوافذ والأقفال","required":true},{"code":"plumbing","label_ar":"السباكة والمياه","required":true},{"code":"electrical","label_ar":"الكهرباء والإنارة","required":true},{"code":"fixtures_appliances","label_ar":"التجهيزات والأجهزة المثبتة","required":false},{"code":"cleanliness","label_ar":"النظافة","required":true},{"code":"meters","label_ar":"قراءات العدادات","required":true},{"code":"keys_access","label_ar":"المفاتيح ووسائل الدخول","required":true}]'::jsonb,
   true, date '2026-01-01'),
  (null, 'SYSTEM_MOVE_OUT', 'MOVE_OUT', 'فحص واستلام الوحدة عند الإخلاء', 1,
   '[{"code":"general_condition","label_ar":"الحالة العامة","required":true},{"code":"walls_ceiling","label_ar":"الجدران والأسقف","required":true},{"code":"floors","label_ar":"الأرضيات","required":true},{"code":"doors_windows_locks","label_ar":"الأبواب والنوافذ والأقفال","required":true},{"code":"plumbing","label_ar":"السباكة والمياه","required":true},{"code":"electrical","label_ar":"الكهرباء والإنارة","required":true},{"code":"fixtures_appliances","label_ar":"التجهيزات والأجهزة المثبتة","required":false},{"code":"cleanliness","label_ar":"النظافة","required":true},{"code":"meters","label_ar":"قراءات العدادات النهائية","required":true},{"code":"keys_access","label_ar":"المفاتيح ووسائل الدخول المستلمة","required":true}]'::jsonb,
   true, date '2026-01-01')
on conflict (code, version_no) where company_id is null do nothing;

do $assert_template_rows$
declare
  v_move_in integer;
  v_move_out integer;
begin
  select count(*) into v_move_in from public.contract_inspection_templates
   where code = 'SYSTEM_MOVE_IN' and company_id is null;
  select count(*) into v_move_out from public.contract_inspection_templates
   where code = 'SYSTEM_MOVE_OUT' and company_id is null;

  if v_move_in <> 1 or v_move_out <> 1 then
    raise exception 'SYSTEM_INSPECTION_TEMPLATE_RESTORE_INVARIANT: expected exactly one system MOVE_IN and one MOVE_OUT template (got % / %)', v_move_in, v_move_out;
  end if;
end
$assert_template_rows$;

commit;