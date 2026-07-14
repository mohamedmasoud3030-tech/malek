-- Baseline capture: live enum types plus users.role/users.status compatibility.
--
-- The code-first baseline creates these columns as text with generated check
-- constraints. Production uses enums without those checks, so clean replay must
-- drop the text constraints before changing the column types.

create type public.user_role as enum ('ADMIN', 'MANAGER', 'USER');
create type public.entity_status as enum ('ACTIVE', 'INACTIVE', 'BLACKLISTED');
create type public.charged_to_type as enum ('OWNER', 'TENANT', 'COMPANY');
create type public.utility_status as enum ('UNPAID', 'PAID', 'OVERDUE');

alter table public.users
  drop constraint if exists users_role_check;
alter table public.users
  drop constraint if exists users_status_check;

alter table public.users
  alter column role drop default;
alter table public.users
  alter column role type public.user_role using role::text::public.user_role;
alter table public.users
  alter column role set default 'USER'::public.user_role;

alter table public.users
  alter column status drop default;
alter table public.users
  alter column status type public.entity_status using status::text::public.entity_status;
alter table public.users
  alter column status set default 'ACTIVE'::public.entity_status;
