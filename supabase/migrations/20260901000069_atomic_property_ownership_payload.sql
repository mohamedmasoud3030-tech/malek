-- TD-01 / R-01 — Atomic Property Ownership Payload.
--
-- Defect being remediated: property/agreement creation and the ownership
-- split were applied by SEPARATE database operations. The browser caller
-- (property onboarding form) first invoked the property/agreement creation
-- RPC and then, in a second set of autocommitted PostgREST round-trips,
-- adjusted the primary-owner percentage and inserted co-owner rows. A
-- failure between those steps left a created property/agreement with an
-- ownership split that was only partially applied (or not applied at all).
--
-- This migration adds a versioned RPC that accepts the complete ownership
-- payload up front and performs property creation, agreement creation, the
-- initial commercial version, the primary-owner share, and every co-owner
-- insertion inside ONE function body — therefore one database transaction.
-- Any validation failure or row-level trigger failure rolls the whole
-- operation back; there is no observable state in which the property/
-- agreement exists while only part of the intended ownership split persisted.
--
-- Additive and forward-only:
--   * no historical migration is modified;
--   * the existing public.create_property_with_agreement and
--     public.create_property_with_versioned_agreement_atomic RPCs are kept
--     as a compatibility seam for existing callers/tests;
--   * this RPC reuses the canonical legacy implementation for the
--     property/agreement/version write sequence (single transaction, same
--     validations, same return shape) and applies the full ownership payload
--     in the same transaction instead of leaving it to the client.
--
-- Ownership payload contract (p_ownership, jsonb array):
--   [
--     { "owner_id": "<uuid>", "ownership_percentage": 60, "is_primary": true  },
--     { "owner_id": "<uuid>", "ownership_percentage": 40, "is_primary": false }
--   ]
-- Rules enforced here (deterministic, before any row is written):
--   * p_ownership omitted/null  -> legacy single-owner default (100% primary).
--   * p_ownership present       -> must be a JSON array of objects.
--   * every entry declares owner_id (uuid), ownership_percentage (numeric),
--     is_primary (boolean).
--   * percentages are positive, <= 100, at most 4 decimal places, and must
--     total EXACTLY 100.
--   * exactly one entry is primary and its owner_id must equal p_owner_id.
--   * no owner_id may appear twice (duplicate owners fail closed).
--   * every owner must exist in the caller's company, be active, and not be
--     soft-deleted (mirrors the legacy primary-owner validation for every
--     owner in the payload).
--   * ownership rows share the agreement window (starts_on/ends_on) with the
--     canonical primary-owner row created by the legacy implementation.
--
-- Failure semantics: any RAISE or row-level constraint/trigger failure inside
-- this function aborts the whole transaction. There is no partial onboarding
-- state and no partial ownership row set after a failed call, so the
-- canonical caller can retry deterministically.

begin;

create or replace function public.create_property_with_ownership_atomic(
  p_title text,
  p_type text,
  p_address text,
  p_owner_id uuid,
  p_agreement_type text,
  p_commission_type text,
  p_commission_value numeric,
  p_agreement_starts_on date,
  p_agreement_ends_on date default null,
  p_owner_name text default null,
  p_purchase_value numeric default null,
  p_current_value numeric default null,
  p_status text default 'active',
  p_notes text default null,
  p_collection_role text default 'OWNER_IS_CREDITOR',
  p_ownership jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_result jsonb;
  v_property_id uuid;
  v_ownership jsonb := p_ownership;
  v_entry jsonb;
  v_owner_id uuid;
  v_percentage numeric;
  v_is_primary boolean;
  v_total numeric := 0;
  v_primary_count integer := 0;
  v_primary_owner_id uuid;
  v_primary_percentage numeric;
  v_seen text[] := '{}';
  v_co_owners jsonb := '[]'::jsonb;
begin
  -- Authorization boundary: identical to the legacy creation RPC (ADMIN or
  -- MANAGER operator of the current company). Kept inline so browser-facing
  -- authorization never depends on table RLS.
  if v_actor is null or not public.is_admin_or_manager() then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنشاء عقار'
      using errcode = '42501';
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'سياق الشركة مطلوب لإنشاء العقار'
      using errcode = '42501';
  end if;

  -- ---------------------------------------------------------------------
  -- Ownership payload validation (runs before any write).
  -- ---------------------------------------------------------------------
  if v_ownership is null then
    -- Compatibility default: single-owner 100% primary, matching the legacy
    -- behavior when no split is supplied.
    v_ownership := jsonb_build_array(jsonb_build_object(
      'owner_id', p_owner_id,
      'ownership_percentage', 100,
      'is_primary', true
    ));
  end if;

  if jsonb_typeof(v_ownership) <> 'array' then
    raise exception 'OWNERSHIP_PAYLOAD_INVALID: صيغة بيانات الملكية يجب أن تكون مصفوفة.'
      using errcode = '22023';
  end if;

  for v_entry in select value from jsonb_array_elements(v_ownership)
  loop
    if jsonb_typeof(v_entry) <> 'object'
       or not (v_entry ? 'owner_id')
       or jsonb_typeof(v_entry->'owner_id') <> 'string'
       or nullif(v_entry->>'owner_id', '') is null then
      raise exception 'OWNERSHIP_PAYLOAD_INVALID: كل سجل ملكية يجب أن يحدد owner_id.'
        using errcode = '22023';
    end if;

    if not (v_entry ? 'is_primary')
       or jsonb_typeof(v_entry->'is_primary') <> 'boolean' then
      raise exception 'OWNERSHIP_PAYLOAD_INVALID: كل سجل ملكية يجب أن يحدد is_primary (true/false).'
        using errcode = '22023';
    end if;

    begin
      v_owner_id := (v_entry->>'owner_id')::uuid;
    exception when others then
      raise exception 'OWNERSHIP_PAYLOAD_INVALID: معرّف المالك في بيانات الملكية غير صحيح.'
        using errcode = '22023';
    end;

    if v_owner_id::text = any (v_seen) then
      raise exception 'OWNERSHIP_DUPLICATE_OWNER: لا يمكن تكرار المالك نفسه في نسب الملكية.'
        using errcode = '23505';
    end if;
    v_seen := v_seen || v_owner_id::text;

    begin
      v_percentage := nullif(v_entry->>'ownership_percentage', '')::numeric;
    exception when others then
      raise exception 'OWNERSHIP_PAYLOAD_INVALID: نسبة الملكية في بيانات الملكية غير صحيحة.'
        using errcode = '22023';
    end;

    -- NaN/Infinity-safe bound check, mirroring the row-level CHECK on
    -- property_owners.ownership_percentage (0 < pct <= 100).
    if v_percentage is null or not (v_percentage > 0 and v_percentage <= 100) then
      raise exception 'نسبة الملكية يجب أن تكون أكبر من صفر وألا تتجاوز 100%%.'
        using errcode = '23514';
    end if;

    -- Storage is numeric(7,4); reject a scale the column would silently
    -- round so the exact-total check is meaningful.
    if round(v_percentage, 4) <> v_percentage then
      raise exception 'OWNERSHIP_PAYLOAD_INVALID: نسبة الملكية لا تدعم أكثر من 4 خانات عشرية.'
        using errcode = '22023';
    end if;

    v_is_primary := (v_entry->>'is_primary')::boolean;
    if v_is_primary then
      v_primary_count := v_primary_count + 1;
      v_primary_owner_id := v_owner_id;
      v_primary_percentage := v_percentage;
    else
      v_co_owners := v_co_owners || jsonb_build_array(v_entry);
    end if;

    v_total := v_total + v_percentage;
  end loop;

  if v_primary_count <> 1 then
    raise exception 'OWNERSHIP_PRIMARY_REQUIRED: يجب تحديد مالك أساسي واحد فقط في نسب الملكية.'
      using errcode = '23514';
  end if;

  if v_primary_owner_id is distinct from p_owner_id then
    raise exception 'OWNERSHIP_PRIMARY_MISMATCH: المالك الأساسي في بيانات الملكية يختلف عن المالك المحدد للعقار.'
      using errcode = '23514';
  end if;

  if v_total <> 100 then
    raise exception 'OWNERSHIP_TOTAL_NOT_100: مجموع نسب الملكية يجب أن يساوي 100%% بالضبط.'
      using errcode = '23514';
  end if;

  -- Every owner (primary and co-owners) must belong to the caller's company
  -- and be active and not soft-deleted. This extends the legacy primary-owner
  -- validation to the full ownership payload and preserves company/tenant
  -- isolation semantics.
  if exists (
    select 1
    from jsonb_array_elements(v_ownership) as entry
    where not exists (
      select 1
      from public.owners o
      where o.id = (entry->>'owner_id')::uuid
        and o.company_id = v_company_id
        and o.deleted_at is null
        and o.is_active
    )
  ) then
    raise exception 'المالك غير موجود في شركتك أو غير نشط أو مؤرشف'
      using errcode = '23514';
  end if;

  -- ---------------------------------------------------------------------
  -- Canonical write sequence, all inside this single transaction:
  -- property -> primary ownership link (100%) -> agreement -> first version
  -- (legacy implementation, reused verbatim), then the ownership split is
  -- applied to the SAME transaction (primary share update + co-owner rows).
  -- ---------------------------------------------------------------------
  select public.create_property_with_versioned_agreement_atomic(
    p_title, p_type, p_address, p_owner_id, p_agreement_type,
    p_commission_type, p_commission_value, p_agreement_starts_on,
    p_agreement_ends_on, p_owner_name, p_purchase_value, p_current_value,
    p_status, p_notes, p_collection_role
  ) into v_result;

  v_property_id := (v_result->>'property_id')::uuid;
  if v_property_id is null then
    raise exception 'OWNERSHIP_PROPERTY_CREATION_FAILED: تعذر إنشاء العقار واتفاقية التشغيل.'
      using errcode = 'P0002';
  end if;

  if v_primary_percentage <> 100 then
    update public.property_owners po
       set ownership_percentage = v_primary_percentage
     where po.property_id = v_property_id
       and po.is_primary;

    if not found then
      raise exception 'OWNERSHIP_PRIMARY_ROW_MISSING: تعذر تحديث حصة المالك الأساسي.'
        using errcode = 'P0002';
    end if;
  end if;

  if jsonb_array_length(v_co_owners) > 0 then
    insert into public.property_owners (
      property_id, owner_id, ownership_percentage, is_primary,
      starts_on, ends_on, company_id
    )
    select
      v_property_id,
      (entry->>'owner_id')::uuid,
      (entry->>'ownership_percentage')::numeric,
      false,
      p_agreement_starts_on,
      p_agreement_ends_on,
      v_company_id
    from jsonb_array_elements(v_co_owners) as entry;
  end if;

  return v_result;
end;
$function$;

alter function public.create_property_with_ownership_atomic(text,text,text,uuid,text,text,numeric,date,date,text,numeric,numeric,text,text,text,jsonb) owner to postgres;

revoke all on function public.create_property_with_ownership_atomic(text,text,text,uuid,text,text,numeric,date,date,text,numeric,numeric,text,text,text,jsonb) from public, anon;
grant execute on function public.create_property_with_ownership_atomic(text,text,text,uuid,text,text,numeric,date,date,text,numeric,numeric,text,text,text,jsonb) to authenticated, service_role;

comment on function public.create_property_with_ownership_atomic(text,text,text,uuid,text,text,numeric,date,date,text,numeric,numeric,text,text,text,jsonb) is
  'TD-01: atomically creates the property, owner-agreement, first commercial version, and the COMPLETE ownership split (primary share + co-owner rows) in one transaction. Validates the ownership payload (exact 100% total, exactly one primary matching p_owner_id, no duplicate owners, every owner active/in-company/not deleted) before any write; any failure rolls back the entire operation. Legacy create_property_with_agreement / create_property_with_versioned_agreement_atomic remain as the compatibility seam for existing callers.';

commit;
