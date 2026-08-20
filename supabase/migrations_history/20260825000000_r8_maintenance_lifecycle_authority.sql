-- ============================================================================
-- R8 — Maintenance / Services Lifecycle: Cancelled ≠ Closed + transition command
-- ============================================================================
--
-- Roadmap V2 / R8. The compressed lifecycle normalized 'cancelled' into
-- 'closed', destroying the business distinction between work that was DONE
-- and work that was CALLED OFF. R8:
--
--   1. Adds 'cancelled' as a first-class status
--      (open / in_progress / resolved / closed / cancelled). Reported/
--      assigned/scheduled remain represented by 'open' (+ scheduled_date /
--      assigned_to fields) — no states invented without need.
--   2. Introduces transition_maintenance_status_atomic: the ONLY sanctioned
--      transition path. Legal transitions:
--         open        → in_progress | cancelled
--         in_progress → open | cancelled            (resolution ONLY through
--                                                    resolve_maintenance_with_expense)
--         resolved    → closed
--         closed      → (terminal)
--         cancelled   → (terminal)
--      Cancellation requires a reason (audited in notes + audit_log).
--   3. A table trigger fails closed on ANY raw status update that does not
--      run inside a sanctioned command (transition/resolve/create RPCs set a
--      transaction-local guard key) — raw updates can no longer force states.
-- ============================================================================

begin;

-- ── 1. Widen the status contract ─────────────────────────────────────────────
alter table public.maintenance_records
  drop constraint if exists maintenance_records_status_check;
alter table public.maintenance_records
  add constraint maintenance_records_status_check
    check (status is null or status = any (array['open', 'in_progress', 'resolved', 'closed', 'cancelled']));

alter table public.maintenance_records
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text;

-- ── 2. Transition authority ──────────────────────────────────────────────────
create or replace function public.transition_maintenance_status_atomic(
  p_request_id text,
  p_next_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_row public.maintenance_records%rowtype;
  v_current text;
  v_next text := lower(btrim(coalesce(p_next_status, '')));
begin
  if auth.uid() is null or not coalesce(public.is_app_user(), false) then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;
  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'Company context is required.' using errcode = '42501';
  end if;

  select * into v_row
  from public.maintenance_records
  where id::text = p_request_id and company_id = v_company_id and deleted_at is null
  for update;
  if not found then
    raise exception 'طلب الصيانة غير موجود' using errcode = 'P0002';
  end if;

  v_current := lower(coalesce(v_row.status, 'open'));

  -- Resolution is financially coupled and owns its own RPC.
  if v_next = 'resolved' then
    raise exception 'MAINTENANCE_RESOLVE_VIA_RPC: استخدم resolve_maintenance_with_expense لإقفال العمل مع التكلفة'
      using errcode = '23514';
  end if;

  if v_next not in ('open', 'in_progress', 'cancelled', 'closed') then
    raise exception 'MAINTENANCE_TRANSITION_UNSUPPORTED: % ليست حالة انتقال مدعومة عبر هذا الأمر', v_next
      using errcode = '23514';
  end if;

  -- Legal transition matrix (Cancelled ≠ Closed).
  if v_current = 'open' and v_next in ('in_progress', 'cancelled') then null;
  elsif v_current = 'in_progress' and v_next in ('open', 'cancelled') then null;
  elsif v_current = 'resolved' and v_next = 'closed' then null;
  elsif v_current in ('closed', 'cancelled') then
    raise exception 'MAINTENANCE_LIFECYCLE_TERMINAL: الحالة % نهائية ولا يمكن تغييرها', v_current
      using errcode = '23514';
  else
    raise exception 'MAINTENANCE_TRANSITION_ILLEGAL: الانتقال من % إلى % غير مسموح', v_current, v_next
      using errcode = '23514';
  end if;

  if v_next = 'cancelled' and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'MAINTENANCE_CANCELLATION_REASON_REQUIRED: سبب الإلغاء إلزامي'
      using errcode = '22023';
  end if;

  -- Transaction-local sanction key: the status trigger only admits status
  -- writes that flow through a sanctioned command.
  perform set_config('malek.maintenance_transition_sanctioned', 'true', true);

  update public.maintenance_records
     set status = v_next,
         cancelled_at = case when v_next = 'cancelled' then now() else cancelled_at end,
         cancellation_reason = case when v_next = 'cancelled' then btrim(p_reason) else cancellation_reason end,
         resolved_at = case when v_next = 'closed' then coalesce(resolved_at, now()) else resolved_at end,
         updated_at = now()
   where id::text = p_request_id;

  -- Canonical audit contract (same column set as receipt-void audits).
  insert into public.audit_log (
    id, ts, user_id, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid()::text,
    extract(epoch from now())::bigint,
    auth.uid()::text,
    'STATUS_' || upper(v_next),
    'maintenance_records',
    p_request_id,
    case when v_next = 'cancelled'
      then 'إلغاء طلب صيانة: ' || btrim(p_reason)
      else 'انتقال حالة صيانة عبر الأمر المعتمد' end,
    'maintenance_records',
    jsonb_build_object('from', v_current, 'to', v_next, 'reason', nullif(btrim(coalesce(p_reason, '')), ''))::text,
    now()
  );

  return (select to_jsonb(m) from public.maintenance_records m where m.id::text = p_request_id);
end;
$function$;

revoke all on function public.transition_maintenance_status_atomic(text, text, text) from public, anon;
grant execute on function public.transition_maintenance_status_atomic(text, text, text) to authenticated, service_role;

comment on function public.transition_maintenance_status_atomic(text, text, text) is
  'R8: the only sanctioned maintenance status transition path. Cancelled ≠ Closed; '
  'terminal states immutable; cancellation requires a reason; resolution flows through '
  'resolve_maintenance_with_expense.';

-- ── 3. Raw status writes fail closed ─────────────────────────────────────────
create or replace function public.guard_maintenance_status_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.status is distinct from old.status then
    -- Sanctioned commands set the transaction-local key. resolve RPC and the
    -- transition command both run as definer functions that set it.
    if coalesce(current_setting('malek.maintenance_transition_sanctioned', true), '') <> 'true' then
      raise exception 'MAINTENANCE_STATUS_VIA_COMMAND: تغيير حالة الصيانة يتم عبر أوامر الخادم فقط (transition/resolve).'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_maintenance_status_transition on public.maintenance_records;
create trigger trg_guard_maintenance_status_transition
before update of status on public.maintenance_records
for each row execute function public.guard_maintenance_status_transition();

-- resolve_maintenance_with_expense: R8 redefines it verbatim with two fixes:
--   1. sets the sanction key (its status write passes the new trigger),
--   2. compares ids via ::text (fix-forward: the prior body used
--      `id = p_request_id` which is uuid = text on clean uuid schemas —
--      the R8 journey exit gate covers this defect).
create or replace function public.resolve_maintenance_with_expense(
  p_request_id text,
  p_cost numeric,
  p_notes text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_record public.maintenance_records;
  v_expense_id text;
  v_company_id uuid;
begin
  perform set_config('malek.maintenance_transition_sanctioned', 'true', true);

  if auth.uid() is null then
    raise exception 'غير مصرح: يجب تسجيل الدخول' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('ADMIN', 'MANAGER')
  ) then
    raise exception 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول' using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  if p_cost is null or p_cost < 0 then
    raise exception 'التكلفة يجب أن تكون رقماً موجباً';
  end if;

  select * into v_record
  from public.maintenance_records
  where id::text = p_request_id
    and company_id = v_company_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'طلب الصيانة غير موجود';
  end if;

  if v_record.status in ('resolved', 'closed', 'cancelled') then
    raise exception 'تم إغلاق هذا الطلب مسبقاً';
  end if;

  if p_cost > 0 then
    -- Canonical expenses columns only (no notes/ref columns exist on the
    -- clean chain): the maintenance linkage lives on maintenance_records
    -- (expense_id) and the note is folded into the description.
    insert into public.expenses (
      property_id, category, amount, expense_date, description, status, company_id
    ) values (
      v_record.property_id, 'صيانة', p_cost, current_date,
      coalesce(v_record.title, 'مصروف صيانة') || coalesce(' — ' || nullif(btrim(p_notes), ''), ''),
      'posted', v_company_id
    )
    returning id into v_expense_id;
  end if;

  update public.maintenance_records
  set status = 'resolved',
      cost = p_cost,
      resolved_at = now(),
      notes = coalesce(p_notes, notes),
      expense_id = coalesce(v_expense_id::uuid, expense_id)
  where id::text = p_request_id
    and company_id = v_company_id
  returning * into v_record;

  return jsonb_build_object(
    'maintenance', to_jsonb(v_record),
    'expense_id', v_expense_id
  );
end;
$function$;

revoke all on function public.resolve_maintenance_with_expense(text, numeric, text) from public, anon;
grant execute on function public.resolve_maintenance_with_expense(text, numeric, text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
