# P0 — مصفوفة أمان الدوال (فحص ساكن، أحدث تعريف)
أُنشئ: 2026-07-23T12:25:32.810Z

الدوال: 92 · منكشفة (تقارير/كتابة مالية): 33 · بحاجة لفحص سلوكي: 19

| الدالة | النوع | secdef | search_path | اشتقاق شركة | انتحال شركة | مبالغ من العميل | REVOKE p/a | منح | الحالة |
|---|---|---|---|---|---|---|---|---|---|
| `_owner_statement_expenses` | helper-or-other | — | ✅ | — | — | — | ✅ | — | ℹ️ داخلي/مساعد |
| `_r3` | helper-or-other | — | ✅ | — | — | — | ⚠️ | — | ℹ️ داخلي/مساعد |
| `_safe_date` | helper-or-other | — | ✅ | — | — | — | ⚠️ | — | ℹ️ داخلي/مساعد |
| `approve_owner_settlement_atomic` | financial-write | ✅ | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `assert_owner_agreement_covers_linked_contracts` | trigger-or-internal | ✅ | ✅ | — | — | — | ✅ | service_role | ✅ سليم ساكنًا |
| `assert_owner_agreement_has_ownership` | trigger-or-internal | — | ✅ | — | — | — | ✅ | — | ℹ️ داخلي/مساعد |
| `assert_property_owner_temporal_integrity` | trigger-or-internal | ✅ | ✅ | — | — | — | ✅ | service_role | ✅ سليم ساكنًا |
| `audit_journal_entry_insert` | trigger-or-internal | ✅ | ✅ | — | — | — | ✅ | service_role | ✅ سليم ساكنًا |
| `cancel_owner_settlement_atomic` | financial-write | ✅ | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `check_unit_maintenance_block` | trigger-or-internal | ✅ | ✅ | — | — | — | ✅ | service_role | ✅ سليم ساكنًا |
| `close_journal_batch` | helper-or-other | ✅ | ✅ | — | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `create_contract_atomic` | financial-write | ✅ | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `create_deposit_atomic` | financial-write | ✅ | ✅ | ✅ | — | 🔴 amount | ✅ | authenticated,service_role | ⚠️ فجوات — يخضع للفحص السلوكي |
| `create_expense_with_journal_atomic` | financial-write | ✅ | ✅ | ✅ | — | 🔴 amount | ✅ | authenticated,service_role | ⚠️ فجوات — يخضع للفحص السلوكي |
| `create_owner_agreement_atomic` | financial-write | ✅ | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `create_owner_settlement_draft_atomic` | financial-write | ✅ | ✅ | ✅ | — | 🔴 gross_collected,office_fee,owner_expenses,tax_amount | ✅ | authenticated,service_role | ⚠️ فجوات — يخضع للفحص السلوكي |
| `create_property_with_agreement` | helper-or-other | ✅ | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `current_app_role` | helper-or-other | ✅ | ✅ | — | — | — | ✅ | service_role | ✅ سليم ساكنًا |
| `current_company_id` | helper-or-other | — | ✅ | ✅ | — | — | ✅ | authenticated | ℹ️ داخلي/مساعد |
| `custom_access_token_hook` | helper-or-other | ✅ | ✅ | — | — | — | ✅ | supabase_auth_admin | ✅ سليم ساكنًا |
| `deduct_deposit_atomic` | financial-write | ✅ | ✅ | ✅ | — | 🔴 amount | ✅ | authenticated,service_role | ⚠️ فجوات — يخضع للفحص السلوكي |
| `enforce_payment_receipt_shared_identity` | trigger-or-internal | — | ✅ | — | — | — | ⚠️ | — | ℹ️ داخلي/مساعد |
| `enforce_unit_operational_status` | trigger-or-internal | — | ✅ | — | — | — | ⚠️ | — | ℹ️ داخلي/مساعد |
| `execute_automation_rule` | helper-or-other | ✅ | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `execute_automation_rule_internal` | helper-or-other | ✅ | ✅ | — | — | — | ✅ | service_role | ✅ سليم ساكنًا |
| `find_payment_account_id` | helper-or-other | ✅ | ✅ | — | — | — | ✅ | — | ✅ سليم ساكنًا |
| `generate_invoices_from_active_contracts` | helper-or-other | ✅ | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `is_admin` | helper-or-other | ✅ | ✅ | — | — | — | ✅ | — | ✅ سليم ساكنًا |
| `is_admin_or_manager` | helper-or-other | ✅ | ✅ | — | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `is_app_user` | helper-or-other | ✅ | ✅ | — | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `normalize_invoice_due_date_text` | trigger-or-internal | — | ✅ | — | — | — | ⚠️ | — | ℹ️ داخلي/مساعد |
| `normalize_unit_status_contract` | trigger-or-internal | — | ✅ | — | — | — | ⚠️ | — | ℹ️ داخلي/مساعد |
| `pay_owner_settlement_atomic` | financial-write | ✅ | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `payment_receipt_identity_preflight` | helper-or-other | — | ✅ | — | — | — | ⚠️ | — | ℹ️ داخلي/مساعد |
| `post_receipt_atomic` | financial-write | ✅ | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `prevent_owner_delete_with_balances` | trigger-or-internal | ✅ | ✅ | — | — | — | ✅ | service_role | ✅ سليم ساكنًا |
| `prevent_payment_receipt_identity_mutation` | trigger-or-internal | — | ✅ | — | — | — | ⚠️ | — | ℹ️ داخلي/مساعد |
| `prevent_posted_journal_entry_mutation` | trigger-or-internal | ✅ | ✅ | — | — | — | ✅ | service_role | ✅ سليم ساكنًا |
| `process_bank_reconciliation_match_atomic` | financial-write | ✅ | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `recalculate_all_balances` | trigger-or-internal | ✅ | ✅ | — | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `recalculate_invoice_status` | trigger-or-internal | ✅ | ✅ | — | — | — | ⚠️ | — | ✅ سليم ساكنًا |
| `recalculate_owner_balance` | trigger-or-internal | ✅ | ✅ | — | — | — | ✅ | — | ✅ سليم ساكنًا |
| `recalculate_unit_statuses` | trigger-or-internal | ✅ | ✅ | — | — | — | ✅ | service_role | ✅ سليم ساكنًا |
| `record_invoice_payment_atomic` | financial-write | ✅ | ✅ | ✅ | — | 🔴 amount | ✅ | authenticated,service_role | ⚠️ فجوات — يخضع للفحص السلوكي |
| `refresh_property_owner_projection` | trigger-or-internal | ✅ | ✅ | — | — | — | ✅ | — | ✅ سليم ساكنًا |
| `refund_deposit_atomic` | financial-write | ✅ | ✅ | ✅ | — | 🔴 amount | ✅ | authenticated,service_role | ⚠️ فجوات — يخضع للفحص السلوكي |
| `renew_contract_atomic` | financial-write | ✅ | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `require_company_id` | helper-or-other | ✅ | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `resolve_maintenance_with_expense` | helper-or-other | ✅ | ✅ | — | — | — | ✅ | authenticated | ✅ سليم ساكنًا |
| `resolve_unit_operational_status` | trigger-or-internal | ✅ | ✅ | — | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `retry_automation_run` | helper-or-other | ✅ | ✅ | — | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `rpt_aged_receivables` | report-read | — | ✅ | ✅ | — | — | ⚠️ | — | ⚠️ فجوات — يخضع للفحص السلوكي |
| `rpt_balance_sheet` | report-read | ✅ | ✅ | — | — | — | ✅ | authenticated,service_role | ⚠️ فجوات — يخضع للفحص السلوكي |
| `rpt_cash_flow` | report-read | ✅ | ✅ | — | — | — | ✅ | authenticated,service_role | ⚠️ فجوات — يخضع للفحص السلوكي |
| `rpt_daily_collection` | report-read | ✅ | ✅ | — | — | — | ✅ | authenticated,service_role | ⚠️ فجوات — يخضع للفحص السلوكي |
| `rpt_dashboard_overview` | report-read | ✅ | ✅ | — | — | — | ✅ | authenticated,service_role | ⚠️ فجوات — يخضع للفحص السلوكي |
| `rpt_financial_summary` | report-read | ✅ | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `rpt_income_statement` | report-read | ✅ | ✅ | — | — | — | ✅ | authenticated,service_role | ⚠️ فجوات — يخضع للفحص السلوكي |
| `rpt_overdue_invoices` | report-read | — | ✅ | ✅ | — | — | ⚠️ | — | ⚠️ فجوات — يخضع للفحص السلوكي |
| `rpt_owner_statement` | report-read | ✅ | ✅ | — | — | — | ✅ | authenticated,service_role | ⚠️ فجوات — يخضع للفحص السلوكي |
| `rpt_rent_roll` | report-read | — | ✅ | ✅ | — | — | ⚠️ | — | ⚠️ فجوات — يخضع للفحص السلوكي |
| `rpt_tenant_statement` | report-read | — | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `rpt_trial_balance` | report-read | ✅ | ✅ | — | — | — | ✅ | authenticated,service_role | ⚠️ فجوات — يخضع للفحص السلوكي |
| `rpt_vat_return` | report-read | ✅ | ✅ | — | — | — | ✅ | authenticated,service_role | ⚠️ فجوات — يخضع للفحص السلوكي |
| `run_scheduled_automation_rules` | helper-or-other | ✅ | ✅ | — | — | — | ✅ | service_role | ✅ سليم ساكنًا |
| `set_owner_agreements_updated_at` | trigger-or-internal | ✅ | ✅ | — | — | — | ✅ | service_role | ✅ سليم ساكنًا |
| `set_updated_at` | trigger-or-internal | — | ✅ | — | — | — | ⚠️ | — | ℹ️ داخلي/مساعد |
| `soft_delete_contract_atomic` | financial-write | ✅ | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `sync_contract_rent_fields` | trigger-or-internal | — | ✅ | — | — | — | ⚠️ | — | ℹ️ داخلي/مساعد |
| `sync_owner_compatibility_fields` | trigger-or-internal | — | ✅ | — | — | — | ✅ | — | ℹ️ داخلي/مساعد |
| `sync_payment_reference_fields` | trigger-or-internal | — | ✅ | — | — | — | ⚠️ | — | ℹ️ داخلي/مساعد |
| `sync_property_compatibility_fields` | trigger-or-internal | — | ✅ | — | — | — | ✅ | — | ℹ️ داخلي/مساعد |
| `sync_property_owner_projection` | trigger-or-internal | ✅ | ✅ | — | — | — | ✅ | — | ✅ سليم ساكنًا |
| `sync_unit_rent_fields` | trigger-or-internal | — | ✅ | — | — | — | ⚠️ | — | ℹ️ داخلي/مساعد |
| `terminate_contract_atomic` | financial-write | ✅ | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `touch_updated_at` | trigger-or-internal | — | ✅ | — | — | — | ⚠️ | — | ℹ️ داخلي/مساعد |
| `update_contract_atomic` | financial-write | ✅ | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `update_contract_balance_from_allocation` | trigger-or-internal | ✅ | ✅ | — | — | — | ✅ | service_role | ✅ سليم ساكنًا |
| `update_contract_balance_from_invoice` | trigger-or-internal | ✅ | ✅ | — | — | — | ✅ | service_role | ✅ سليم ساكنًا |
| `update_contract_balance_on_receipt_allocation` | helper-or-other | ✅ | ✅ | — | — | — | ✅ | — | ✅ سليم ساكنًا |
| `update_expense_with_journal_atomic` | financial-write | ✅ | ✅ | ✅ | — | 🔴 amount | ✅ | authenticated,service_role | ⚠️ فجوات — يخضع للفحص السلوكي |
| `update_invoice_status` | helper-or-other | ✅ | ✅ | — | — | — | ✅ | — | ✅ سليم ساكنًا |
| `update_owner_agreement_atomic` | financial-write | ✅ | ✅ | ✅ | — | — | ✅ | authenticated,service_role | ✅ سليم ساكنًا |
| `update_owner_balance_from_operation` | trigger-or-internal | ✅ | ✅ | — | — | — | ✅ | — | ✅ سليم ساكنًا |
| `update_owner_balance_on_expense` | helper-or-other | ✅ | ✅ | — | — | — | ✅ | — | ✅ سليم ساكنًا |
| `update_tenant_balance` | helper-or-other | — | ✅ | — | — | — | ✅ | — | ℹ️ داخلي/مساعد |
| `update_unit_status` | helper-or-other | — | ✅ | — | — | — | ✅ | — | ℹ️ داخلي/مساعد |
| `update_unit_status_from_activity` | trigger-or-internal | ✅ | ✅ | — | — | — | ⚠️ | — | ✅ سليم ساكنًا |
| `update_updated_at` | helper-or-other | — | ✅ | — | — | — | ⚠️ | — | ℹ️ داخلي/مساعد |
| `validate_journal_batch_balance` | trigger-or-internal | ✅ | ✅ | — | — | — | ✅ | service_role | ✅ سليم ساكنًا |
| `validate_property_owner_active_totals` | trigger-or-internal | — | ✅ | — | — | — | ⚠️ | — | ℹ️ داخلي/مساعد |
| `void_receipt_atomic` | financial-write | ✅ | ✅ | — | — | — | ✅ | anon,authenticated,service_role | ⚠️ فجوات — يخضع للفحص السلوكي |

> تُستكمل هذه المصفوفة بالفحص السلوكي (PGlite isolated replay) في `behavioral-isolation.*`.