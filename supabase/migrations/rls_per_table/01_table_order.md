# ترتيب تفعيل RLS على الجداول

نفّذ كل جدول واحد واحد، واختبر بعد كل واحد.

## Group A — Core (الأهم — اختبرهم الأول)

1. `properties`
2. `units`
3. `owners`
4. `people`
5. `tenants`
6. `contracts`
7. `property_owners`

## Group B — Financial

8. `invoices`
9. `payments`
10. `receipts`
11. `receipt_allocations`
12. `expenses`
13. `accounts`
14. `journal_entries`
15. `contract_balances`
16. `owner_balances`
17. `account_balances`
18. `tenant_balances`

## Group C — Operations

19. `maintenance_records`
20. `lands`
21. `leads`
22. `commissions`
23. `utility_bills`
24. `utility_meters`
25. `company-assets`

## Group D — Advanced Features

26. `vault_documents`
27. `contract_documents`
28. `owner_settlements`
29. `deposit_txs`
30. `deposit_transactions`
31. `tenant_deposits`
32. `bank_accounts`
33. `bank_statement_imports`
34. `bank_statement_lines`
35. `bank_reconciliation_matches`
36. `budgets`
37. `serials`
38. `status_history`
39. `status_transition_rules`
40. `kpi_snapshots`
41. `snapshots`
42. `company_settings`

## Group E — Automation & Notifications

43. `automation_rules`
44. `automation_runs`
45. `automation_run_logs`
46. `automation_notifications`
47. `notifications`
48. `app_notifications`
49. `notification_templates`
50. `outgoing_notifications`
51. `communication_records`
52. `missions`
53. `attachments`

---

## Indexes (بعد ما كل الـ RLS يتفعّل)

```sql
do $$
declare
  tbl text;
begin
  for tbl in array[
    'properties', 'property_owners', 'owners', 'units', 'people',
    'tenants', 'contracts', 'invoices', 'payments', 'receipts',
    'receipt_allocations', 'expenses', 'maintenance_records',
    'contract_balances', 'owner_balances', 'accounts', 'journal_entries',
    'lands', 'leads', 'commissions', 'utility_bills', 'utility_meters',
    'vault_documents', 'contract_documents', 'owner_settlements',
    'deposit_txs', 'deposit_transactions', 'tenant_deposits',
    'bank_accounts', 'bank_statement_imports', 'bank_statement_lines',
    'bank_reconciliation_matches', 'budgets', 'account_balances',
    'tenant_balances', 'serials', 'status_history',
    'status_transition_rules', 'kpi_snapshots', 'snapshots',
    'company_settings',
    'automation_rules', 'automation_runs', 'automation_run_logs',
    'automation_notifications', 'notifications', 'app_notifications',
    'notification_templates', 'outgoing_notifications',
    'communication_records', 'missions', 'attachments'
  ] loop
    execute format(
      'create index if not exists %I on public.%I (company_id)',
      'idx_' || tbl || '_company_id', tbl
    );
  end loop;
end;
$$;

create index if not exists idx_company_assets_company_id
  on public."company-assets" (company_id);
```
