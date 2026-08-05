-- Rollback for 20260805000001_bank_csv_import_hardening
-- Drops the new RPC and columns added for Stage 4 bank import hardening.
-- This is forward rollback script (manual) — not part of forward migrations.
begin;

drop function if exists public.import_bank_statement_batch_atomic(jsonb);

-- Drop indexes
drop index if exists public.ux_bank_imports_company_fingerprint;
drop index if exists public.idx_bank_imports_fingerprint;
drop index if exists public.ux_bank_lines_company_fingerprint;
drop index if exists public.idx_bank_lines_possible_dup;

-- Note: we keep added columns for safety (additive rollback would be destructive)
-- If full rollback required, uncomment below:
-- alter table public.bank_statement_imports drop column if exists file_name;
-- alter table public.bank_statement_imports drop column if exists file_fingerprint;
-- alter table public.bank_statement_imports drop column if exists file_size;
-- alter table public.bank_statement_imports drop column if exists total_rows;
-- alter table public.bank_statement_imports drop column if exists accepted_rows;
-- alter table public.bank_statement_imports drop column if exists rejected_rows;
-- alter table public.bank_statement_imports drop column if exists duplicate_rows;
-- alter table public.bank_statement_imports drop column if exists possible_duplicate_rows;
-- alter table public.bank_statement_imports drop column if exists status;
-- alter table public.bank_statement_imports drop column if exists error_summary;
-- alter table public.bank_statement_imports drop column if exists processed_at;
-- alter table public.bank_statement_lines drop column if exists fingerprint;
-- alter table public.bank_statement_lines drop column if exists balance;
-- alter table public.bank_statement_lines drop column if exists currency;
-- alter table public.bank_statement_lines drop column if exists external_reference;

commit;
