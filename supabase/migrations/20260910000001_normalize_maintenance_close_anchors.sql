-- OPS-001 — restore `close_maintenance_with_expense` to its canonical repository
-- text so the anchor-based patch in 20260909000012 can apply.
--
-- WHY THIS EXISTS
-- 20260909000012 extends the maintenance command by string-patching the output
-- of pg_get_functiondef() using five exact-text anchors. On the hosted database
-- four of those five anchors do not match, so the migration aborts at its own
-- precondition guard (OWNER_EXPENSE_MAINTENANCE_CONTRACT_PRECONDITION). That is
-- the guard working correctly, not a hosted fault.
--
-- ROOT CAUSE (proven, not assumed)
-- The hosted function is byte-different from the repository's but LOGICALLY
-- IDENTICAL: stripping all whitespace from both definitions yields the same
-- 3165 characters. The differences are purely formatting, e.g.
--     hosted : 'charged_to',v_charged_to,     v_charged_to text:=upper(...)
--     repo   : 'charged_to', v_charged_to,    v_charged_to text := upper(...)
-- The hosted database applied 20260901000038 from its ORIGINAL source; repo
-- commit 8258c528 later rewrote that already-applied migration file and changed
-- its formatting. A merged migration is supposed to be immutable, so that
-- rewrite left the hosted database in a state the repository no longer
-- describes. This migration reconciles the drift FORWARD, rather than editing
-- 20260901000038 again or weakening the guard in 20260909000012.
--
-- WHAT THIS CHANGES
-- Behaviour: nothing. The body below is not hand-written -- it was captured
-- mechanically from a clean replay of the repository chain through
-- 20260909000011, so it is exactly what the repository already produces. Since
-- the hosted and repository definitions are whitespace-equivalent, restoring
-- this text changes stored source formatting only.
--
-- SAFETY
-- The block refuses to act unless the hosted body is whitespace-identical to
-- this canonical text. If the hosted logic has genuinely diverged it aborts
-- instead of overwriting that divergence. Idempotent, forward-only, no data
-- touched, no grant widened.

begin;

do $normalize$
declare
  v_def text;
begin
  -- Order-independent by design. On a clean repository replay 20260909000012
  -- has already dropped the six-argument overload and installed the extended
  -- eight-argument one, so there is nothing to normalize and this exits
  -- quietly. It only does work on a database (such as the hosted one) whose
  -- six-argument definition still carries the pre-8258c528 formatting.
  if to_regprocedure('public.close_maintenance_with_expense(text,numeric,text,text,text,boolean)') is null then
    return;
  end if;

  v_def := pg_get_functiondef(
    'public.close_maintenance_with_expense(text,numeric,text,text,text,boolean)'::regprocedure);

  -- Already canonical (fresh database, or this migration already ran).
  if position('''charged_to'', v_charged_to,' in v_def) > 0 then
    return;
  end if;

  -- Whitespace-insensitive equality is the safety proof.
  if regexp_replace(v_def, '\s', '', 'g')
     is distinct from regexp_replace($canon$
CREATE OR REPLACE FUNCTION public.close_maintenance_with_expense(p_request_id text, p_cost numeric, p_charged_to text, p_notes text DEFAULT NULL::text, p_evidence_url text DEFAULT NULL::text, p_confirmed boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
  v_row public.maintenance_records%rowtype;
  v_charged_to text := upper(btrim(coalesce(p_charged_to, '')));
  v_expense_result jsonb;
  v_expense_id uuid;
begin
  if auth.uid() is null or not coalesce(public.current_user_has_effective_app_permission('maintenance.approve'), false) then
    raise exception 'ADMIN or MANAGER role is required to close maintenance financially.' using errcode = '42501';
  end if;
  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'Company context is required.' using errcode = '42501';
  end if;
  if not coalesce(p_confirmed, false) then
    raise exception 'MAINTENANCE_CONFIRMATION_REQUIRED: يجب تأكيد تنفيذ العمل قبل الإغلاق' using errcode = '23514';
  end if;
  if p_cost is null or p_cost < 0 or p_cost <> round(p_cost, 3) then
    raise exception 'MAINTENANCE_COST_INVALID: التكلفة الفعلية يجب أن تكون قيمة موجبة أو صفرية بدقة 3 منازل' using errcode = '22023';
  end if;
  if v_charged_to not in ('OWNER', 'TENANT', 'COMPANY') then
    raise exception 'MAINTENANCE_CHARGE_TARGET_INVALID: حدد المالك أو المستأجر أو المكتب' using errcode = '22023';
  end if;

  select * into v_row
    from public.maintenance_records
   where id::text = p_request_id
     and company_id = v_company_id
     and deleted_at is null
   for update;
  if not found then
    raise exception 'طلب الصيانة غير موجود' using errcode = 'P0002';
  end if;
  if lower(coalesce(v_row.status, '')) <> 'resolved' then
    raise exception 'MAINTENANCE_CLOSE_REQUIRES_COMPLETION: لا يمكن الإغلاق قبل تسجيل تم التنفيذ' using errcode = '23514';
  end if;

  if p_cost > 0 then
    v_expense_result := public.create_expense_with_journal_atomic(
      jsonb_build_object(
        'request_id', 'maintenance-close:' || p_request_id,
        'property_id', v_row.property_id,
        'category', 'صيانة',
        'amount', p_cost,
        'expense_date', current_date,
        'charged_to', v_charged_to,
        'description', coalesce(v_row.title, 'مصروف صيانة') || coalesce(' — ' || nullif(btrim(p_notes), ''), '')
      )
    );
    v_expense_id := nullif(v_expense_result->>'expense_id', '')::uuid;
    if v_expense_id is null then
      raise exception 'MAINTENANCE_EXPENSE_LINK_MISSING: لم يرجع مسار المصروف المعتمد مرجع المصروف' using errcode = '23514';
    end if;
  end if;

  perform set_config('malek.maintenance_transition_sanctioned', 'true', true);
  update public.maintenance_records
     set status = 'closed',
         cost = p_cost,
         charged_to = v_charged_to,
         notes = coalesce(nullif(btrim(p_notes), ''), notes),
         attachment_url = coalesce(nullif(btrim(p_evidence_url), ''), attachment_url),
         expense_id = coalesce(v_expense_id, expense_id),
         resolved_at = now(),
         updated_at = now()
   where id = v_row.id
   returning * into v_row;

  insert into public.audit_log (id, ts, user_id, action, entity, entity_id, note, "table", details, created_at)
  values (
    gen_random_uuid()::text, extract(epoch from now())::bigint, auth.uid()::text,
    'CLOSED_VERIFIED', 'maintenance_records', p_request_id,
    'إغلاق صيانة بعد تحقق تشغيلي ومالي', 'maintenance_records',
    jsonb_build_object(
      'cost', p_cost,
      'charged_to', v_charged_to,
      'expense_id', v_expense_id,
      'evidence_url', nullif(btrim(p_evidence_url), ''),
      'confirmed', true
    )::text,
    now()
  );
  return jsonb_build_object('maintenance', to_jsonb(v_row), 'expense_id', coalesce(v_expense_id, v_row.expense_id));
end;
$function$
$canon$, '\s', '', 'g') then
    raise exception
      'MAINTENANCE_CLOSE_NORMALIZE_DIVERGENT: hosted definition differs beyond whitespace; refusing to overwrite'
      using errcode = '23514';
  end if;

  execute $canon$
CREATE OR REPLACE FUNCTION public.close_maintenance_with_expense(p_request_id text, p_cost numeric, p_charged_to text, p_notes text DEFAULT NULL::text, p_evidence_url text DEFAULT NULL::text, p_confirmed boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
  v_row public.maintenance_records%rowtype;
  v_charged_to text := upper(btrim(coalesce(p_charged_to, '')));
  v_expense_result jsonb;
  v_expense_id uuid;
begin
  if auth.uid() is null or not coalesce(public.current_user_has_effective_app_permission('maintenance.approve'), false) then
    raise exception 'ADMIN or MANAGER role is required to close maintenance financially.' using errcode = '42501';
  end if;
  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'Company context is required.' using errcode = '42501';
  end if;
  if not coalesce(p_confirmed, false) then
    raise exception 'MAINTENANCE_CONFIRMATION_REQUIRED: يجب تأكيد تنفيذ العمل قبل الإغلاق' using errcode = '23514';
  end if;
  if p_cost is null or p_cost < 0 or p_cost <> round(p_cost, 3) then
    raise exception 'MAINTENANCE_COST_INVALID: التكلفة الفعلية يجب أن تكون قيمة موجبة أو صفرية بدقة 3 منازل' using errcode = '22023';
  end if;
  if v_charged_to not in ('OWNER', 'TENANT', 'COMPANY') then
    raise exception 'MAINTENANCE_CHARGE_TARGET_INVALID: حدد المالك أو المستأجر أو المكتب' using errcode = '22023';
  end if;

  select * into v_row
    from public.maintenance_records
   where id::text = p_request_id
     and company_id = v_company_id
     and deleted_at is null
   for update;
  if not found then
    raise exception 'طلب الصيانة غير موجود' using errcode = 'P0002';
  end if;
  if lower(coalesce(v_row.status, '')) <> 'resolved' then
    raise exception 'MAINTENANCE_CLOSE_REQUIRES_COMPLETION: لا يمكن الإغلاق قبل تسجيل تم التنفيذ' using errcode = '23514';
  end if;

  if p_cost > 0 then
    v_expense_result := public.create_expense_with_journal_atomic(
      jsonb_build_object(
        'request_id', 'maintenance-close:' || p_request_id,
        'property_id', v_row.property_id,
        'category', 'صيانة',
        'amount', p_cost,
        'expense_date', current_date,
        'charged_to', v_charged_to,
        'description', coalesce(v_row.title, 'مصروف صيانة') || coalesce(' — ' || nullif(btrim(p_notes), ''), '')
      )
    );
    v_expense_id := nullif(v_expense_result->>'expense_id', '')::uuid;
    if v_expense_id is null then
      raise exception 'MAINTENANCE_EXPENSE_LINK_MISSING: لم يرجع مسار المصروف المعتمد مرجع المصروف' using errcode = '23514';
    end if;
  end if;

  perform set_config('malek.maintenance_transition_sanctioned', 'true', true);
  update public.maintenance_records
     set status = 'closed',
         cost = p_cost,
         charged_to = v_charged_to,
         notes = coalesce(nullif(btrim(p_notes), ''), notes),
         attachment_url = coalesce(nullif(btrim(p_evidence_url), ''), attachment_url),
         expense_id = coalesce(v_expense_id, expense_id),
         resolved_at = now(),
         updated_at = now()
   where id = v_row.id
   returning * into v_row;

  insert into public.audit_log (id, ts, user_id, action, entity, entity_id, note, "table", details, created_at)
  values (
    gen_random_uuid()::text, extract(epoch from now())::bigint, auth.uid()::text,
    'CLOSED_VERIFIED', 'maintenance_records', p_request_id,
    'إغلاق صيانة بعد تحقق تشغيلي ومالي', 'maintenance_records',
    jsonb_build_object(
      'cost', p_cost,
      'charged_to', v_charged_to,
      'expense_id', v_expense_id,
      'evidence_url', nullif(btrim(p_evidence_url), ''),
      'confirmed', true
    )::text,
    now()
  );
  return jsonb_build_object('maintenance', to_jsonb(v_row), 'expense_id', coalesce(v_expense_id, v_row.expense_id));
end;
$function$
$canon$;

  -- Ownership/ACLs survive CREATE OR REPLACE; re-assert least privilege anyway.
  revoke all on function public.close_maintenance_with_expense(text,numeric,text,text,text,boolean) from public, anon;
end
$normalize$;

commit;
