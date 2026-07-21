-- ============================================================================
-- Multi-Tenant Company Isolation — Rentrix
-- ============================================================================
--
-- يحول Rentrix من تطبيق مكتب واحد إلى منصة متعددة المكاتب (Multi-Tenant SaaS).
-- كل صف في كل جدول عملياتي يحمل company_id، وسياسات RLS تمنع العزل بين المكاتب.
--
-- التنفيذ على 8 مراحل، كل مرحلة تعتمد على السابقة:
--
--   Phase 1: إنشاء جداول companies و company_members
--   Phase 2: بذرة شركة افتراضية (Default Company) من بيانات المكتب الحالي
--   Phase 3: إضافة company_id nullable لكل الجداول Tier 1 + Tier 2
--   Phase 4: Backfill — ربط كل الصفوف الموجودة بالشركة الافتراضية
--   Phase 5: NOT NULL + FK constraint بعد التحقق
--   Phase 6: دالة current_company_id() + تحديث custom_access_token_hook
--   Phase 7: RLS policies للعزل بين المكاتب (جدول بجدول)
--   Phase 8: Indexes للأداء
--
-- ⚠️ قاعدة صارمة: ممنوع تفعيل RLS company-scoped قبل التأكد إن كل الصفوف
--    فيها company_id صحيح. تفعيل مبكر = قفل الوصول للبيانات.
--
-- ============================================================================

begin;

-- ============================================================================
-- Phase 1: إنشاء جداول Multi-Tenancy الأساسية
-- ============================================================================

-- 1a. جدول المكاتب/الشركات
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

-- 1b. جدول ربط المستخدمين بالمكاتب (Many-to-Many)
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
create index if not exists idx_company_members_company_id
  on public.company_members (company_id) where is_active;

-- 1c. RLS على جداول multi-tenancy نفسها
alter table public.companies enable row level security;
alter table public.company_members enable row level security;

-- المستخدمين يقرؤوا شركاتهم فقط
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

-- عضو يقرأ عضويته فقط، والأدمن يقرأ الكل
create policy company_members_read_own on public.company_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- الأدمن يديروا العضويات
create policy company_members_admin_write on public.company_members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- عضو الشركة يعدّل عضويته فقط (مثلاً يغير شركته النشطة)
create policy company_members_update_own on public.company_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ============================================================================
-- Phase 2: بذرة شركة افتراضية — حماية البيانات القائمة
-- ============================================================================

-- ننشئ شركة افتراضية واحدة تمثل بيانات المكتب الحالي
-- نستخدم اسم الشركة من company_settings إذا موجود، أو اسم عام
insert into public.companies (id, name, slug, currency, locale, timezone)
select
  '00000000-0000-0000-0000-000000000001'::uuid,
  coalesce(
    (select company_name from public.company_settings limit 1),
    'Rentrix Default Company'
  ),
  'default',
  coalesce(
    (select currency from public.company_settings limit 1),
    'OMR'
  ),
  coalesce(
    (select locale from public.company_settings limit 1),
    'ar-OM'
  ),
  coalesce(
    (select timezone from public.company_settings limit 1),
    'Asia/Muscat'
  )
on conflict (id) do nothing;

-- ربط كل المستخدمين الحاليين بالشركة الافتراضية كـ OWNER
-- (لو فيه مستخدمين في public.users أو auth.users)
insert into public.company_members (company_id, user_id, role)
select
  '00000000-0000-0000-0000-000000000001'::uuid,
  u.id,
  case
    when u.role = 'ADMIN' then 'OWNER'
    when u.role = 'MANAGER' then 'ADMIN'
    else 'MEMBER'
  end
from public.users u
where u.deleted_at is null and u.is_active
on conflict (company_id, user_id) do nothing;

-- لو مفيش مستخدمين في public.users، نربط من auth.users مباشرة
insert into public.company_members (company_id, user_id, role)
select
  '00000000-0000-0000-0000-000000000001'::uuid,
  au.id,
  'OWNER'
from auth.users au
where not exists (
  select 1 from public.company_members cm where cm.user_id = au.id
)
on conflict (company_id, user_id) do nothing;


-- ============================================================================
-- Phase 3: إضافة company_id nullable لكل الجداول Tier 1
-- ============================================================================

-- Tier 1: جداول عملياتية أساسية
alter table public.properties        add column if not exists company_id uuid;
alter table public.property_owners   add column if not exists company_id uuid;
alter table public.owners            add column if not exists company_id uuid;
alter table public.units             add column if not exists company_id uuid;
alter table public.people            add column if not exists company_id uuid;
alter table public.tenants           add column if not exists company_id uuid;
alter table public.contracts         add column if not exists company_id uuid;
alter table public.invoices          add column if not exists company_id uuid;
alter table public.payments          add column if not exists company_id uuid;
alter table public.receipts          add column if not exists company_id uuid;
alter table public.receipt_allocations add column if not exists company_id uuid;
alter table public.expenses          add column if not exists company_id uuid;
alter table public.maintenance_records add column if not exists company_id uuid;
alter table public.contract_balances add column if not exists company_id uuid;
alter table public.owner_balances    add column if not exists company_id uuid;
alter table public.accounts          add column if not exists company_id uuid;
alter table public.journal_entries   add column if not exists company_id uuid;

-- Tier 1: جداول إضافية
alter table public.lands             add column if not exists company_id uuid;
alter table public.leads             add column if not exists company_id uuid;
alter table public.commissions       add column if not exists company_id uuid;
alter table public.utility_bills     add column if not exists company_id uuid;
alter table public.utility_meters    add column if not exists company_id uuid;
alter table public.vault_documents   add column if not exists company_id uuid;
alter table public.contract_documents add column if not exists company_id uuid;
alter table public.owner_settlements add column if not exists company_id uuid;
alter table public.deposit_txs       add column if not exists company_id uuid;
alter table public.deposit_transactions add column if not exists company_id uuid;
alter table public.tenant_deposits   add column if not exists company_id uuid;
alter table public.bank_accounts     add column if not exists company_id uuid;
alter table public.bank_statement_imports add column if not exists company_id uuid;
alter table public.bank_statement_lines add column if not exists company_id uuid;
alter table public.bank_reconciliation_matches add column if not exists company_id uuid;
alter table public.budgets           add column if not exists company_id uuid;
alter table public."company-assets"  add column if not exists company_id uuid;
alter table public.account_balances  add column if not exists company_id uuid;
alter table public.tenant_balances   add column if not exists company_id uuid;
alter table public.serials           add column if not exists company_id uuid;
alter table public.status_history    add column if not exists company_id uuid;
alter table public.status_transition_rules add column if not exists company_id uuid;
alter table public.kpi_snapshots     add column if not exists company_id uuid;
alter table public.snapshots         add column if not exists company_id uuid;

-- Tier 2: جداول Scoped
alter table public.automation_rules  add column if not exists company_id uuid;
alter table public.automation_runs   add column if not exists company_id uuid;
alter table public.automation_run_logs add column if not exists company_id uuid;
alter table public.automation_notifications add column if not exists company_id uuid;
alter table public.notifications     add column if not exists company_id uuid;
alter table public.app_notifications add column if not exists company_id uuid;
alter table public.notification_templates add column if not exists company_id uuid;
alter table public.outgoing_notifications add column if not exists company_id uuid;
alter table public.communication_records add column if not exists company_id uuid;
alter table public.missions          add column if not exists company_id uuid;
alter table public.attachments       add column if not exists company_id uuid;

-- company_settings: إضافة company_id وربطها بالشركة
alter table public.company_settings  add column if not exists company_id uuid;


-- ============================================================================
-- Phase 4: Backfill — ربط كل الصفوف الموجودة بالشركة الافتراضية
-- ============================================================================

-- ⚠️ هذا هو الجزء الأهم: لو أي صف فضل بـ company_id = NULL بعد المرحلة دي،
--    الـ RLS هيمنع الوصول ليه. لازم نتأكد إن كل الصفوف اتربطت.

do $$
declare
  default_company uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  tbl text;
begin
  -- Tier 1 core
  for tbl in array[
    'properties', 'property_owners', 'owners', 'units', 'people',
    'tenants', 'contracts', 'invoices', 'payments', 'receipts',
    'receipt_allocations', 'expenses', 'maintenance_records',
    'contract_balances', 'owner_balances', 'accounts', 'journal_entries'
  ] loop
    execute format(
      'update public.%I set company_id = $1 where company_id is null',
      tbl
    ) using default_company;
  end loop;

  -- Tier 1 extended
  for tbl in array[
    'lands', 'leads', 'commissions', 'utility_bills', 'utility_meters',
    'vault_documents', 'contract_documents', 'owner_settlements',
    'deposit_txs', 'deposit_transactions', 'tenant_deposits',
    'bank_accounts', 'bank_statement_imports', 'bank_statement_lines',
    'bank_reconciliation_matches', 'budgets', 'account_balances',
    'tenant_balances', 'serials', 'status_history',
    'status_transition_rules', 'kpi_snapshots', 'snapshots'
  ] loop
    execute format(
      'update public.%I set company_id = $1 where company_id is null',
      tbl
    ) using default_company;
  end loop;

  -- company-assets (has hyphen in name)
  update public."company-assets" set company_id = default_company
    where company_id is null;

  -- Tier 2: scoped tables
  for tbl in array[
    'automation_rules', 'automation_runs', 'automation_run_logs',
    'automation_notifications', 'notifications', 'app_notifications',
    'notification_templates', 'outgoing_notifications',
    'communication_records', 'missions', 'attachments'
  ] loop
    execute format(
      'update public.%I set company_id = $1 where company_id is null',
      tbl
    ) using default_company;
  end loop;

  -- company_settings backfill
  update public.company_settings set company_id = default_company
    where company_id is null;
end;
$$;


-- ============================================================================
-- Phase 4b: تحقق — لازم يكون صفر صفوف بـ company_id IS NULL
-- ============================================================================

-- هذا الـ DO block يتحقق ويرفع exception لو فيه أي صف ناقص
do $$
declare
  default_company uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  tbl text;
  null_count bigint;
  total_nulls bigint := 0;
  failing_tables text[] := '{}';
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
    'status_transition_rules', 'kpi_snapshots', 'snapshots'
  ] loop
    execute format(
      'select count(*) from public.%I where company_id is null',
      tbl
    ) into null_count;

    if null_count > 0 then
      failing_tables := failing_tables || tbl;
      total_nulls := total_nulls + null_count;
    end if;
  end loop;

  -- company-assets
  select count(*) into null_count
    from public."company-assets" where company_id is null;
  if null_count > 0 then
    failing_tables := failing_tables || 'company-assets';
    total_nulls := total_nulls + null_count;
  end if;

  for tbl in array[
    'automation_rules', 'automation_runs', 'automation_run_logs',
    'automation_notifications', 'notifications', 'app_notifications',
    'notification_templates', 'outgoing_notifications',
    'communication_records', 'missions', 'attachments'
  ] loop
    execute format(
      'select count(*) from public.%I where company_id is null',
      tbl
    ) into null_count;

    if null_count > 0 then
      failing_tables := failing_tables || tbl;
      total_nulls := total_nulls + null_count;
    end if;
  end loop;

  if total_nulls > 0 then
    raise exception
      'BACKFILL VERIFICATION FAILED: % rows with NULL company_id in tables: %',
      total_nulls, array_to_string(failing_tables, ', ')
      using hint = 'Do NOT proceed to Phase 5. Fix the backfill first.';
  end if;
end;
$$;


-- ============================================================================
-- Phase 5: NOT NULL + FK constraint (بعد التأكد إن كل الصفوف مربوطة)
-- ============================================================================

do $$
declare
  tbl text;
begin
  -- Tier 1 core
  for tbl in array[
    'properties', 'property_owners', 'owners', 'units', 'people',
    'tenants', 'contracts', 'invoices', 'payments', 'receipts',
    'receipt_allocations', 'expenses', 'maintenance_records',
    'contract_balances', 'owner_balances', 'accounts', 'journal_entries'
  ] loop
    execute format(
      'alter table public.%I alter column company_id set not null',
      tbl
    );
    execute format(
      'alter table public.%I add constraint %I_company_id_fkey foreign key (company_id) references public.companies(id) on delete restrict',
      tbl, tbl
    );
  end loop;

  -- Tier 1 extended
  for tbl in array[
    'lands', 'leads', 'commissions', 'utility_bills', 'utility_meters',
    'vault_documents', 'contract_documents', 'owner_settlements',
    'deposit_txs', 'deposit_transactions', 'tenant_deposits',
    'bank_accounts', 'bank_statement_imports', 'bank_statement_lines',
    'bank_reconciliation_matches', 'budgets', 'account_balances',
    'tenant_balances', 'serials', 'status_history',
    'status_transition_rules', 'kpi_snapshots', 'snapshots'
  ] loop
    execute format(
      'alter table public.%I alter column company_id set not null',
      tbl
    );
    execute format(
      'alter table public.%I add constraint %I_company_id_fkey foreign key (company_id) references public.companies(id) on delete restrict',
      tbl, tbl
    );
  end loop;

  -- company-assets (special name)
  alter table public."company-assets" alter column company_id set not null;
  alter table public."company-assets"
    add constraint "company-assets_company_id_fkey"
    foreign key (company_id) references public.companies(id) on delete restrict;

  -- company_settings
  alter table public.company_settings alter column company_id set not null;
  alter table public.company_settings
    add constraint company_settings_company_id_fkey
    foreign key (company_id) references public.companies(id) on delete restrict;

  -- Tier 2: nullable company_id (these can exist without a company temporarily)
  for tbl in array[
    'automation_rules', 'automation_runs', 'automation_run_logs',
    'automation_notifications', 'notifications', 'app_notifications',
    'notification_templates', 'outgoing_notifications',
    'communication_records', 'missions', 'attachments'
  ] loop
    execute format(
      'alter table public.%I alter column company_id set not null',
      tbl
    );
    execute format(
      'alter table public.%I add constraint %I_company_id_fkey foreign key (company_id) references public.companies(id) on delete restrict',
      tbl, tbl
    );
  end loop;
end;
$$;


-- ============================================================================
-- Phase 6: دالة current_company_id() + تحديث JWT hook
-- ============================================================================

-- 6a. دالة تستخرج الشركة النشطة من JWT
create or replace function public.current_company_id()
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
$$;

-- 6b. Grant محدود — فقط authenticated يقدروا يستخدموها
revoke all on function public.current_company_id() from public, anon, authenticated;
grant execute on function public.current_company_id() to authenticated;

-- 6c. تحديث custom_access_token_hook لحقن company_id في JWT
create or replace function public.custom_access_token_hook(event jsonb)
  returns jsonb
  language plpgsql
  stable security definer
  set search_path to 'public'
as $function$
declare
  claims    jsonb;
  user_role text;
  user_company uuid;
begin
  -- استخراج الدور من public.users
  select role::text
    into user_role
    from public.users
   where id = (event->>'user_id')::uuid
     and status = 'ACTIVE';

  claims := event -> 'claims';

  if jsonb_typeof(claims -> 'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  -- حقن user_role (كما كان)
  claims := jsonb_set(
    claims,
    '{app_metadata, user_role}',
    to_jsonb(coalesce(user_role, 'USER'))
  );

  -- حقن company_id: الشركة الأولى النشطة للمستخدم
  select cm.company_id
    into user_company
    from public.company_members cm
   where cm.user_id = (event->>'user_id')::uuid
     and cm.is_active
   limit 1;

  if user_company is not null then
    claims := jsonb_set(
      claims,
      '{app_metadata, company_id}',
      to_jsonb(user_company)
    );
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$function$;


-- ============================================================================
-- Phase 7: RLS policies للعزل بين المكاتب
-- ============================================================================

-- Helper: نستخدم نفس النمط لكل جدول عملياتي
-- policy name pattern: {table}_company_isolation

-- 7a. Tier 1 Core tables
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
    'company_settings'
  ] loop
    -- Company isolation: المستخدم يشوف بيانات شركته فقط
    execute format(
      'create policy %I_company_isolation on public.%I
        for all to authenticated
        using (company_id = public.current_company_id())
        with check (company_id = public.current_company_id())',
      tbl, tbl
    );
  end loop;
end;
$$;

-- company-assets (special name with hyphen)
create policy "company-assets_company_isolation" on public."company-assets"
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- 7b. Tier 2: Scoped tables (automation, notifications, etc.)
do $$
declare
  tbl text;
begin
  for tbl in array[
    'automation_rules', 'automation_runs', 'automation_run_logs',
    'automation_notifications', 'notifications', 'app_notifications',
    'notification_templates', 'outgoing_notifications',
    'communication_records', 'missions', 'attachments'
  ] loop
    execute format(
      'create policy %I_company_isolation on public.%I
        for all to authenticated
        using (company_id = public.current_company_id())
        with check (company_id = public.current_company_id())',
      tbl, tbl
    );
  end loop;
end;
$$;

-- 7c. استثناءات مهمة: جداول لها policies خاصة

-- users: يبقى cross-company (المستخدم يشوف حسابه)
-- لا نغير الـ policies الحالية على users

-- audit_log: يتتبع company_id لكن يبقى للأدمن بس
-- نضيف company_id للـ policy الحالية بدل ما نعمل policy جديدة
-- (الـ audit_log هيحتاج تحديث منفصل لأنه ليه policy خاصة بالأدمن)

-- financial_operation_idempotency: ممنوع الوصول المباشر (كما هو)
-- لا تغيير

-- profiles, sessions, automation_jobs, governance:
-- جداول نظام — لا تحتاج company isolation


-- ============================================================================
-- Phase 8: Indexes للأداء
-- ============================================================================

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

-- company-assets (special name)
create index if not exists idx_company_assets_company_id
  on public."company-assets" (company_id);


-- ============================================================================
-- Phase 9: تحديث company_settings ليتربط بالشركة الافتراضية
-- ============================================================================

--company_settings تبقى الشركة الافتراضية
-- لو فيه أكثر من صف (مش متوقع)، نربطهم كلهم
update public.company_settings
set company_id = '00000000-0000-0000-0000-000000000001'::uuid
where company_id is null;


commit;
