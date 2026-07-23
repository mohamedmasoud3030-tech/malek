-- ============================================================================
-- PHASE 1 of 5 — Create companies + company_members + Seed default company
-- ============================================================================
--
-- الهدف:
--   1. إنشاء جدول companies وجدول company_members
--   2. بذرة شركة افتراضية واحدة من بيانات company_settings الحالية
--   3. ربط كل المستخدمين الحاليين بالشركة الافتراضية
--
-- ⚠️ هذا الـmigration يعمل ONLY:
--   - إنشاء الجداول + RLS أساسي عليهم
--   - بذرة البيانات
--   - لا يلمس أي جدول بيانات آخر
--   - لا يفعّل RLS company-scoped على أي جدول
--
-- ============================================================================

begin;

-- ── 1a. جدول المكاتب/الشركات ─────────────────────────────────────────────

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  currency text not null default 'OMR',
  locale text not null default 'ar-OM',
  timezone text not null default 'Asia/Muscat',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 1b. جدول ربط المستخدمين بالمكاتب (Many-to-Many) ─────────────────────

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'MEMBER'
    check (role in ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists idx_company_members_user_id
  on public.company_members (user_id);
create index if not exists idx_company_members_company_active
  on public.company_members (company_id) where is_active;

-- ── 1c. RLS على الجداول الجديدة نفسها ────────────────────────────────────

alter table public.companies enable row level security;
alter table public.company_members enable row level security;

-- عضو الشركة يشوف بيانات شركته
create policy companies_member_read on public.companies
  for select to authenticated
  using (
    exists (
      select 1 from public.company_members cm
      where cm.company_id = companies.id
        and cm.user_id = auth.uid()
        and cm.is_active
    )
  );

-- عضو يشوف عضويته + الأدمن يشوفوا الكل
create policy company_members_read_own on public.company_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- الأدمن يديروا العضويات
create policy company_members_admin_write on public.company_members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── 1d. بذرة الشركة الافتراضية ───────────────────────────────────────────

insert into public.companies (id, name, slug, currency, locale, timezone)
select
  '00000000-0000-4000-8000-000000000001'::uuid,
  coalesce(
    (select company_name from public.company_settings limit 1),
    'Rentrix Default Company'
  ),
  'default',
  coalesce((select currency from public.company_settings limit 1), 'OMR'),
  coalesce((select locale from public.company_settings limit 1), 'ar-OM'),
  coalesce((select timezone from public.company_settings limit 1), 'Asia/Muscat')
on conflict (id) do nothing;

-- ── 1e. ربط المستخدمين الحاليين ─────────────────────────────────────────

-- من public.users (لو موجودين)
insert into public.company_members (company_id, user_id, role)
select
  '00000000-0000-4000-8000-000000000001'::uuid,
  u.id,
  case
    when u.role = 'ADMIN' then 'OWNER'
    when u.role = 'MANAGER' then 'ADMIN'
    else 'MEMBER'
  end
from public.users u
where u.deleted_at is null and u.is_active
on conflict (company_id, user_id) do nothing;

-- من auth.users مباشرة (لو في مستخدمين مش في public.users)
insert into public.company_members (company_id, user_id, role)
select
  '00000000-0000-4000-8000-000000000001'::uuid,
  au.id,
  'OWNER'
from auth.users au
where not exists (
  select 1 from public.company_members cm where cm.user_id = au.id
)
on conflict (company_id, user_id) do nothing;

-- ── 1f. التحقق ───────────────────────────────────────────────────────────

-- تأكد إن الشركة الافتراضية موجودة
do $$
declare
  company_count int;
  member_count int;
begin
  select count(*) into company_count
    from public.companies
   where id = '00000000-0000-4000-8000-000000000001'::uuid;

  select count(*) into member_count
    from public.company_members
   where company_id = '00000000-0000-4000-8000-000000000001'::uuid;

  raise notice '=== PHASE 1 VERIFICATION ===';
  raise notice 'Default company exists: %', company_count = 1;
  raise notice 'Members linked to default company: %', member_count;

  if company_count != 1 then
    raise exception 'PHASE 1 FAILED: Default company was not created';
  end if;

  if member_count = 0 then
    raise warning 'PHASE 1 WARNING: No members linked to default company. This might be OK if there are no users yet.';
  end if;
end;
$$;

commit;
