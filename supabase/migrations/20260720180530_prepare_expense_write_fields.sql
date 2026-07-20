begin;

-- Historical production already exposes these operational expense fields,
-- while a clean replay may only contain the smaller canonical table shape.
-- Add the missing columns before replacing the atomic RPCs so both layouts
-- converge without rewriting existing values.
alter table public.expenses
  add column if not exists contract_id text,
  add column if not exists charged_to text,
  add column if not exists status text default 'POSTED',
  add column if not exists date_time text,
  add column if not exists no text;

-- Preserve the current production behavior for rows created through older
-- paths while leaving existing explicit statuses untouched.
update public.expenses
set status = 'POSTED'
where status is null;

commit;
