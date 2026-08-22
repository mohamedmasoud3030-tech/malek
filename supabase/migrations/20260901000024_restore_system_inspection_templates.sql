-- 20260901000024_restore_system_inspection_templates.sql
--
-- Canonicalization data regression fix: the canonical baseline (schema-only
-- dump) and seed.sql do not provision the SYSTEM_MOVE_IN / SYSTEM_MOVE_OUT
-- contract-inspection templates, which the pre-canonical chain seeded in
-- 20260830010000_contract_registration_and_handover_evidence.sql. Every
-- consumer depends on them:
--   * save_contract_inspection_draft_atomic rejects drafts without an active
--     system template (INSPECTION_TEMPLATE_INVALID)
--   * complete_contract_inspection_atomic / create_deposit_application_claim_
--     with_inspection_atomic require a reviewed SYSTEM_MOVE_OUT inspection
--   * get_contract_evidence_state returns inspection_templates to the UI
--
-- This migration restores ONLY the two missing system reference rows, with the
-- exact identifiers, localized labels, checklist definitions, ordering,
-- required flags and effective dates from the historical source. It is
-- deterministic and idempotent (partial unique index on code+version_no where
-- company_id is null). Existing inspection records are not touched.

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

-- Re-running the migration must never duplicate the system templates.
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
