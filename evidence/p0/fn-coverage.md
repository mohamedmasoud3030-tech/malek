| function | existed pre-P0 | kind | rollback action | rollback covered | signature+SECURITY match |
|---|---|---|---|---|---|
| require_company_id | false | create | drop function (created by P0) | ✅ | n/a (new) |
| rpt_cash_flow | true | replace | restore pre-P0 body | ✅ | ✅ |
| rpt_dashboard_overview | true | replace | restore pre-P0 body | ✅ | ✅ |
| rpt_daily_collection | true | replace | restore pre-P0 body | ✅ | ✅ |
| rpt_vat_return | true | replace | restore pre-P0 body | ✅ | ✅ |
| rpt_financial_summary | true | replace | restore pre-P0 body | ✅ | ✅ |
| rpt_trial_balance | true | replace | restore pre-P0 body | ✅ | ✅ |
| rpt_income_statement | true | replace | restore pre-P0 body | ✅ | ✅ |
| rpt_balance_sheet | true | replace | restore pre-P0 body | ✅ | ✅ |
| rpt_owner_statement | true | replace | restore pre-P0 body | ✅ | ✅ |
| rpt_tenant_statement | true | replace | restore pre-P0 body | ✅ | ✅ |
| rpt_aged_receivables | true | replace | restore pre-P0 body | ✅ | ✅ |
| rpt_overdue_invoices | true | replace | restore pre-P0 body | ✅ | ✅ |
| rpt_rent_roll | true | replace | restore pre-P0 body | ✅ | ✅ |
| create_owner_settlement_draft_atomic | true | replace | restore pre-P0 body | ✅ | ✅ |
| record_invoice_payment_atomic | true | replace | restore pre-P0 body | ✅ | ✅ |
| post_receipt_atomic | true | replace | restore pre-P0 body | ✅ | ✅ |
| update_contract_balance_from_allocation | true | replace | restore pre-P0 body | ✅ | ✅ |
| create_owner_agreement_atomic | true | replace | restore pre-P0 body | ✅ | ✅ |
