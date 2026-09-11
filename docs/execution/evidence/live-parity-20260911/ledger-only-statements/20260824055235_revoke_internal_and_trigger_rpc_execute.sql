-- Harden internal/service and trigger-helper EXECUTE boundaries.
--
-- Default privileges GRANT ALL ON FUNCTIONS TO authenticated re-opened many
-- helpers that the canonical dump already intended as service/trigger-only.
-- This migration restores that boundary. It does not change function bodies,
-- trigger attachments, ownership, or search_path.
--
-- Browser-facing orchestration RPCs are intentionally left authenticated.

begin;

revoke all on function public.assert_owner_agreement_covers_linked_contracts() from public, anon, authenticated; grant execute on function public.assert_owner_agreement_covers_linked_contracts() to service_role;
revoke all on function public.assert_property_owner_temporal_integrity() from public, anon, authenticated; grant execute on function public.assert_property_owner_temporal_integrity() to service_role;
revoke all on function public.audit_service_provider_change() from public, anon, authenticated; grant execute on function public.audit_service_provider_change() to service_role;
revoke all on function public.backfill_owner_settlement_links() from public, anon, authenticated; grant execute on function public.backfill_owner_settlement_links() to service_role;
revoke all on function public.capture_owner_funds_receipt_void_reversal() from public, anon, authenticated; grant execute on function public.capture_owner_funds_receipt_void_reversal() to service_role;
revoke all on function public.capture_owner_funds_settlement_payout() from public, anon, authenticated; grant execute on function public.capture_owner_funds_settlement_payout() to service_role;
revoke all on function public.close_superseded_tax_profile_windows() from public, anon, authenticated; grant execute on function public.close_superseded_tax_profile_windows() to service_role;
revoke all on function public.enforce_app_permission_catalog() from public, anon, authenticated; grant execute on function public.enforce_app_permission_catalog() to service_role;
revoke all on function public.enforce_contract_workflow_invariants() from public, anon, authenticated; grant execute on function public.enforce_contract_workflow_invariants() to service_role;
revoke all on function public.execute_automation_rule(text) from public, anon, authenticated; grant execute on function public.execute_automation_rule(text) to service_role;
revoke all on function public.gl_accrue_fixed_monthly_day(uuid,uuid,date,uuid) from public, anon, authenticated; grant execute on function public.gl_accrue_fixed_monthly_day(uuid,uuid,date,uuid) to service_role;
revoke all on function public.gl_create_journal_batch(jsonb) from public, anon, authenticated; grant execute on function public.gl_create_journal_batch(jsonb) to service_role;
revoke all on function public.gl_ensure_initial_open_period(uuid,date) from public, anon, authenticated; grant execute on function public.gl_ensure_initial_open_period(uuid,date) to service_role;
revoke all on function public.gl_ml_create_initial_measurement(jsonb) from public, anon, authenticated; grant execute on function public.gl_ml_create_initial_measurement(jsonb) to service_role;
revoke all on function public.gl_ml_create_remeasurement(jsonb) from public, anon, authenticated; grant execute on function public.gl_ml_create_remeasurement(jsonb) to service_role;
revoke all on function public.gl_ml_post_initial_recognition(jsonb) from public, anon, authenticated; grant execute on function public.gl_ml_post_initial_recognition(jsonb) to service_role;
revoke all on function public.gl_ml_post_period(jsonb) from public, anon, authenticated; grant execute on function public.gl_ml_post_period(jsonb) to service_role;
revoke all on function public.gl_ml_post_remeasurement(jsonb) from public, anon, authenticated; grant execute on function public.gl_ml_post_remeasurement(jsonb) to service_role;
revoke all on function public.gl_ml_provision_supporting_accounts(uuid) from public, anon, authenticated; grant execute on function public.gl_ml_provision_supporting_accounts(uuid) to service_role;
revoke all on function public.gl_pm_post_deposit_application(jsonb) from public, anon, authenticated; grant execute on function public.gl_pm_post_deposit_application(jsonb) to service_role;
revoke all on function public.gl_pm_post_deposit_refund(jsonb) from public, anon, authenticated; grant execute on function public.gl_pm_post_deposit_refund(jsonb) to service_role;
revoke all on function public.gl_post_journal_batch(uuid) from public, anon, authenticated; grant execute on function public.gl_post_journal_batch(uuid) to service_role;
revoke all on function public.gl_reverse_fixed_monthly_accrual(uuid,uuid,text,uuid) from public, anon, authenticated; grant execute on function public.gl_reverse_fixed_monthly_accrual(uuid,uuid,text,uuid) to service_role;
revoke all on function public.guard_company_onboarding_events_immutable() from public, anon, authenticated; grant execute on function public.guard_company_onboarding_events_immutable() to service_role;
revoke all on function public.guard_contract_agreement_snapshot() from public, anon, authenticated; grant execute on function public.guard_contract_agreement_snapshot() to service_role;
revoke all on function public.guard_fee_tax_rows_immutable() from public, anon, authenticated; grant execute on function public.guard_fee_tax_rows_immutable() to service_role;
revoke all on function public.guard_fixed_monthly_daily_ledger_immutable() from public, anon, authenticated; grant execute on function public.guard_fixed_monthly_daily_ledger_immutable() to service_role;
revoke all on function public.guard_invoice_credit_immutability() from public, anon, authenticated; grant execute on function public.guard_invoice_credit_immutability() to service_role;
revoke all on function public.guard_invoice_payment_tax_allocation_immutable() from public, anon, authenticated; grant execute on function public.guard_invoice_payment_tax_allocation_immutable() to service_role;
revoke all on function public.guard_invoice_payment_tax_allocation_lineage() from public, anon, authenticated; grant execute on function public.guard_invoice_payment_tax_allocation_lineage() to service_role;
revoke all on function public.guard_invoice_rc1_accounting_lineage() from public, anon, authenticated; grant execute on function public.guard_invoice_rc1_accounting_lineage() to service_role;
revoke all on function public.guard_owner_funds_cutover_immutable() from public, anon, authenticated; grant execute on function public.guard_owner_funds_cutover_immutable() to service_role;
revoke all on function public.guard_owner_funds_event_cutover() from public, anon, authenticated; grant execute on function public.guard_owner_funds_event_cutover() to service_role;
revoke all on function public.guard_owner_funds_event_immutable() from public, anon, authenticated; grant execute on function public.guard_owner_funds_event_immutable() to service_role;
revoke all on function public.guard_owner_funds_event_lineage() from public, anon, authenticated; grant execute on function public.guard_owner_funds_event_lineage() to service_role;
revoke all on function public.guard_property_archive() from public, anon, authenticated; grant execute on function public.guard_property_archive() to service_role;
revoke all on function public.guard_receipt_allocation_invoice_credit_ceiling() from public, anon, authenticated; grant execute on function public.guard_receipt_allocation_invoice_credit_ceiling() to service_role;
revoke all on function public.guard_taxable_line_tax_snapshot_immutable() from public, anon, authenticated; grant execute on function public.guard_taxable_line_tax_snapshot_immutable() to service_role;
revoke all on function public.guard_unit_archive_history() from public, anon, authenticated; grant execute on function public.guard_unit_archive_history() to service_role;
revoke all on function public.invoice_document_integrity() from public, anon, authenticated; grant execute on function public.invoice_document_integrity() to service_role;
revoke all on function public.invoice_lineage_guard() from public, anon, authenticated; grant execute on function public.invoice_lineage_guard() to service_role;
revoke all on function public.journal_entries_view_insert() from public, anon, authenticated; grant execute on function public.journal_entries_view_insert() to service_role;
revoke all on function public.journal_entries_view_reject_mutation() from public, anon, authenticated; grant execute on function public.journal_entries_view_reject_mutation() to service_role;
revoke all on function public.owner_agreement_version_for_contract_internal(uuid,uuid,date,date) from public, anon, authenticated; grant execute on function public.owner_agreement_version_for_contract_internal(uuid,uuid,date,date) to service_role;
revoke all on function public.owner_settlement_maker_checker_guard() from public, anon, authenticated; grant execute on function public.owner_settlement_maker_checker_guard() to service_role;
revoke all on function public.post_journal_event(jsonb) from public, anon, authenticated; grant execute on function public.post_journal_event(jsonb) to service_role;
revoke all on function public.prevent_owner_delete_with_balances() from public, anon, authenticated; grant execute on function public.prevent_owner_delete_with_balances() to service_role;
revoke all on function public.project_invoice_payment_status_with_credits() from public, anon, authenticated; grant execute on function public.project_invoice_payment_status_with_credits() to service_role;
revoke all on function public.recalculate_owner_balance(uuid) from public, anon, authenticated; grant execute on function public.recalculate_owner_balance(uuid) to service_role;
revoke all on function public.refresh_property_owner_projection(text) from public, anon, authenticated; grant execute on function public.refresh_property_owner_projection(text) to service_role;
revoke all on function public.resolve_active_fee_tax_treatment(uuid,text,date) from public, anon, authenticated; grant execute on function public.resolve_active_fee_tax_treatment(uuid,text,date) to service_role;
revoke all on function public.resolve_active_tax_profile(uuid,date) from public, anon, authenticated; grant execute on function public.resolve_active_tax_profile(uuid,date) to service_role;
revoke all on function public.reverse_journal_batch(uuid) from public, anon, authenticated; grant execute on function public.reverse_journal_batch(uuid) to service_role;
revoke all on function public.set_owner_agreements_updated_at() from public, anon, authenticated; grant execute on function public.set_owner_agreements_updated_at() to service_role;
revoke all on function public.sync_property_owner_projection() from public, anon, authenticated; grant execute on function public.sync_property_owner_projection() to service_role;
revoke all on function public.update_contract_balance_from_allocation() from public, anon, authenticated; grant execute on function public.update_contract_balance_from_allocation() to service_role;
revoke all on function public.update_contract_balance_from_invoice() from public, anon, authenticated; grant execute on function public.update_contract_balance_from_invoice() to service_role;
revoke all on function public.update_contract_balance_on_receipt_allocation() from public, anon, authenticated; grant execute on function public.update_contract_balance_on_receipt_allocation() to service_role;
revoke all on function public.update_invoice_status() from public, anon, authenticated; grant execute on function public.update_invoice_status() to service_role;
revoke all on function public.update_owner_balance_from_operation() from public, anon, authenticated; grant execute on function public.update_owner_balance_from_operation() to service_role;
revoke all on function public.update_owner_balance_on_expense() from public, anon, authenticated; grant execute on function public.update_owner_balance_on_expense() to service_role;
revoke all on function public.validate_journal_batch_balance() from public, anon, authenticated; grant execute on function public.validate_journal_batch_balance() to service_role;
revoke all on function public.validate_maintenance_service_provider_assignment() from public, anon, authenticated; grant execute on function public.validate_maintenance_service_provider_assignment() to service_role;
revoke all on function public.void_receipt_atomic(jsonb) from public, anon, authenticated; grant execute on function public.void_receipt_atomic(jsonb) to service_role;
revoke all on function public.wp01_audit_sole_admin_setting_change() from public, anon, authenticated; grant execute on function public.wp01_audit_sole_admin_setting_change() to service_role;

commit;