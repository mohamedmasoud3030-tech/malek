begin;

create or replace function public.guard_journal_line_rc1_revenue_scope()
returns trigger
language plpgsql
set search_path to public, pg_temp
as $$
declare
  v_account_no text;
  v_source_type text;
begin
  if coalesce(new.credit, 0) <= 0 then return new; end if;
  select a.no, b.source_type into v_account_no, v_source_type
    from public.journal_batches b
    join public.accounts a on a.id = new.account_id and a.company_id = b.company_id
   where b.id = new.batch_id;
  if v_account_no is null then return new; end if;
  if v_account_no = '4000' and coalesce(btrim(v_source_type), '') !~ '^master_lease' then
    raise exception 'RC1_4000_NON_MASTER_LEASE_CREDIT_BLOCKED: account 4000 (Sublease Rental Revenue) may only be credited by master-lease postings (source_type master_lease_*); batch source_type % must use the locked owner-agency chart (2000 owner funds / 4100 management fee).', v_source_type using errcode = '23514';
  end if;
  return new;
end;
$$;
alter function public.guard_journal_line_rc1_revenue_scope() owner to postgres;
grant execute on function public.guard_journal_line_rc1_revenue_scope() to service_role;
revoke all on function public.guard_journal_line_rc1_revenue_scope() from public, anon, authenticated;
comment on function public.guard_journal_line_rc1_revenue_scope() is 'RC1 defensive guard (FIN-001/GAP-006): rejects journal lines crediting 4000 unless the batch is a master-lease posting. Owner-agency rent is agent-net; 4000 is master-lease sublease revenue only.';
drop trigger if exists trg_guard_journal_line_rc1_revenue_scope on public.journal_lines;
create trigger trg_guard_journal_line_rc1_revenue_scope before insert or update on public.journal_lines for each row execute function public.guard_journal_line_rc1_revenue_scope();

do $commissions_preflight$
declare v_violations integer;
begin
  select count(*) into v_violations from public.commissions where lower(coalesce(btrim(type), '')) = 'payment';
  if v_violations > 0 then raise exception 'RC1_COMMISSION_PAYMENT_ROWS_PRESENT: % commission row(s) use the removed payment source type; review through the governed correction path before installing the canonical type domain.', v_violations using errcode = '23514'; end if;
end
$commissions_preflight$;
alter table public.commissions drop constraint if exists commissions_type_check;
alter table public.commissions add constraint commissions_type_check check (type is null or type = any (array['contract'::text, 'owner'::text, 'lead'::text, 'land'::text]));
comment on constraint commissions_type_check on public.commissions is 'RC1 closeout (Rule 4): commission source domain is contract/owner/lead/land. payment is not a commission source type; approval/payment/reversal of valid commissions are unaffected.';

create or replace function public.create_commission_atomic(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare
  v_company_id uuid; v_request_id text := nullif(btrim(p_payload->>'request_id'), ''); v_staff_name text := nullif(btrim(p_payload->>'staff_name'), ''); v_type text := lower(nullif(btrim(p_payload->>'type'), '')); v_source_id text := nullif(btrim(p_payload->>'source_id'), ''); v_deal_value numeric := nullif(btrim(p_payload->>'deal_value'), '')::numeric; v_percentage numeric := nullif(btrim(p_payload->>'percentage'), '')::numeric; v_amount numeric := nullif(btrim(p_payload->>'amount'), '')::numeric; v_comm public.commissions%rowtype; v_cached jsonb; v_result jsonb; v_operation_name text; v_request_fingerprint text; v_cached_fingerprint text;
begin
  if auth.uid() is null or not coalesce(public.is_admin_or_manager(), false) then raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنشاء عمولة' using errcode='42501'; end if;
  v_company_id := public.require_company_id();
  if v_staff_name is null then raise exception 'اسم الموظف أو الوسيط مطلوب.' using errcode='22023'; end if;
  if v_type = 'payment' then raise exception 'COMMISSION_TYPE_PAYMENT_REMOVED: payment is not a commission source type in RC1; commissions attach to a contract, owner, lead or land source.' using errcode='23514'; end if;
  if v_type is null or v_type not in ('contract','owner','lead','land') then raise exception 'نوع مصدر العمولة غير صحيح.' using errcode='22023'; end if;
  if v_deal_value is not null and v_deal_value < 0 then raise exception 'قيمة الصفقة يجب أن تكون صفراً أو أكبر.' using errcode='22023'; end if;
  if v_percentage is not null and (v_percentage < 0 or v_percentage > 100) then raise exception 'نسبة العمولة يجب أن تكون بين صفر و100.' using errcode='22023'; end if;
  if v_amount is null and v_deal_value is not null and v_percentage is not null then v_amount := round(v_deal_value * (v_percentage / 100.0), 2); end if;
  if v_amount is null or v_amount <= 0 then raise exception 'أدخل قيمة عمولة أكبر من صفر أو قيمة الصفقة والنسبة.' using errcode='22023'; end if;
  if v_request_id is null then v_request_id := gen_random_uuid()::text; end if;
  v_operation_name := 'create_commission_atomic:' || v_company_id::text;
  v_request_fingerprint := encode(sha256(convert_to(jsonb_build_object('staff_name',v_staff_name,'type',v_type,'source_id',v_source_id,'deal_value',v_deal_value,'percentage',v_percentage,'amount',v_amount)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(v_operation_name || ':' || v_request_id, 0));
  select response_payload into v_cached from public.financial_operation_idempotency where operation_name=v_operation_name and request_id=v_request_id for update;
  if v_cached is not null then v_cached_fingerprint := v_cached->>'_request_fingerprint'; if v_cached_fingerprint is null or not (v_cached ? 'response') then raise exception 'IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED' using errcode='22023'; end if; if v_cached_fingerprint <> v_request_fingerprint then raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode='22023'; end if; return (v_cached->'response') || jsonb_build_object('idempotent',true); end if;
  insert into public.commissions(id,staff_name,type,status,source_id,deal_value,percentage,amount,paid_at,expense_id,company_id,created_at,updated_at)
  values(gen_random_uuid()::text,v_staff_name,v_type,'pending',v_source_id,v_deal_value,v_percentage,v_amount,null,null,v_company_id,now(),now()) returning * into v_comm;
  insert into public.audit_log(id,ts,user_id,username,action,entity,entity_id,note,"table",details,created_at)
  values(gen_random_uuid(),extract(epoch from now())::bigint,auth.uid(),(select email from auth.users where id=auth.uid()),'CREATE','commissions',v_comm.id,'Commission created through trusted RPC with server-derived company and pending status','commissions',left(jsonb_build_object('request_id',v_request_id,'staff_name',v_staff_name,'type',v_type,'source_id',v_source_id,'deal_value',v_deal_value,'percentage',v_percentage,'amount',v_amount)::text,4000),now());
  v_result := jsonb_build_object('success',true,'idempotent',false,'commission_id',v_comm.id,'status',v_comm.status,'request_id',v_request_id,'commission',to_jsonb(v_comm));
  insert into public.financial_operation_idempotency(operation_name,request_id,response_payload) values(v_operation_name,v_request_id,jsonb_build_object('_request_fingerprint',v_request_fingerprint,'response',v_result));
  return v_result;
end;
$$;
alter function public.create_commission_atomic(jsonb) owner to postgres;

create or replace function public.guard_invoice_charge_type_rc1_scope()
returns trigger language plpgsql set search_path to public, pg_temp as $$
begin
  if upper(coalesce(btrim(new.charge_type), '')) = 'LATE_FEE' then raise exception 'RC1_LATE_FEE_FAIL_CLOSED: LATE_FEE charges have no approved canonical mapping in RC1 (ADR-0017 Decision C / DP-4, decision D09) and are rejected at the database level.' using errcode='23514'; end if;
  return new;
end;
$$;
alter function public.guard_invoice_charge_type_rc1_scope() owner to postgres;
grant execute on function public.guard_invoice_charge_type_rc1_scope() to service_role;
revoke all on function public.guard_invoice_charge_type_rc1_scope() from public, anon, authenticated;
drop trigger if exists trg_guard_invoice_charge_type_rc1_scope on public.invoices;
create trigger trg_guard_invoice_charge_type_rc1_scope before insert or update on public.invoices for each row execute function public.guard_invoice_charge_type_rc1_scope();

create or replace function public.guard_automation_job_rc1_scope()
returns trigger language plpgsql set search_path to public, pg_temp as $$
begin
  if upper(coalesce(btrim(new.job_type), '')) = 'LATE_FEE' then raise exception 'RC1_LATE_FEE_JOB_FAIL_CLOSED: LATE_FEE automation jobs are disabled by default (decision D09) and rejected at the database level until the governed late-fee accounting mapping is approved.' using errcode='23514'; end if;
  return new;
end;
$$;
alter function public.guard_automation_job_rc1_scope() owner to postgres;
grant execute on function public.guard_automation_job_rc1_scope() to service_role;
revoke all on function public.guard_automation_job_rc1_scope() from public, anon, authenticated;
drop trigger if exists trg_guard_automation_job_rc1_scope on public.automation_jobs;
create trigger trg_guard_automation_job_rc1_scope before insert or update on public.automation_jobs for each row execute function public.guard_automation_job_rc1_scope();

commit;