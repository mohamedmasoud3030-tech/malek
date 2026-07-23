# P0 — جرد آلي لسطح قاعدة البيانات × استخدام الواجهة
أُنشئ: 2026-07-23T10:28:12.415Z · الهجرات المفحوصة: 152

## الخلاصة
- الجداول: **68** (تستخدمها الواجهة: **34**)
- الدوال: **91** (تستدعيها الواجهة: **32**)
- حسب النوع: helper-or-other=25 · financial-write=20 · trigger-or-internal=33 · report-read=13
- دوال تقارير لا تستدعيها الواجهة: `rpt_aged_receivables`, `rpt_daily_collection`, `rpt_financial_summary`, `rpt_overdue_invoices`, `rpt_rent_roll`

## جداول خادمية (تُدار بالمحفزات/RPCs — لا تقرأها الواجهة وهذا متوقع)
- `account_balances`
- `accounts`
- `bank_reconciliation_matches`
- `companies`
- `contract_balances`
- `financial_operation_idempotency`
- `journal_entries`
- `owner_balances`
- `receipt_allocations`
- `receipts`
- `tenant_balances`
- `users`

## جداول «علية» مرشّحة للتجميد التوثيقي (لا يقرأها Frontend ولا منطق خادمي معروف)
- `app_notifications`
- `auto_backups`
- `automation_jobs`
- `automation_run_logs`
- `budgets`
- `company-assets`
- `deposit_txs`
- `governance`
- `kpi_snapshots`
- `missions`
- `notification_templates`
- `notifications`
- `outgoing_notifications`
- `profiles`
- `schema_refactor_notes`
- `serials`
- `sessions`
- `settings`
- `snapshots`
- `status_history`
- `status_transition_rules`
- `tenants`

> إعادة التشغيل: `node scripts/p0/inventory.mjs`