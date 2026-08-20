-- align company_members.role CHECK constraint with the canonical six-role model
-- (ADMIN, MANAGER, ACCOUNTANT, OPERATIONS, USER, VIEWER).
--
-- The original constraint allowed legacy values (OWNER, MEMBER) that are
-- incompatible with the approved SEC-004 role model.  This migration replaces
-- it without a NOT VALID step because no production rows use legacy values
-- at the time of writing (verified by the 2026-08-20 full-project audit).

begin;

alter table public.company_members
  drop constraint if exists company_members_role_check;

alter table public.company_members
  add constraint company_members_role_check
  check (role = any (array[
    'ADMIN'::text,
    'MANAGER'::text,
    'ACCOUNTANT'::text,
    'OPERATIONS'::text,
    'USER'::text,
    'VIEWER'::text
  ]));

commit;