-- WP-01 / GAP-002: correct the sole-admin setting INSERT boundary.
--
-- The original closeout trigger correctly blocked direct UPDATEs of the
-- sensitive setting, but its INSERT branch also rejected ordinary creation of
-- a company_settings row when allow_sole_admin_self_approval remained at its
-- fail-closed default FALSE. That made unrelated company-settings bootstrap
-- paths fail after the migration.
--
-- Correct semantics:
--   * ordinary INSERT with FALSE/default FALSE is allowed;
--   * direct INSERT with TRUE is prohibited unless performed by the governed
--     set_sole_admin_self_approval_atomic RPC context;
--   * every UPDATE that changes the setting remains RPC-only;
--   * every activation/deactivation is audited with actor/reason/company/time.

begin;

create or replace function public.wp01_audit_sole_admin_setting_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_old_val boolean := false;
  v_new_val boolean := coalesce(new.allow_sole_admin_self_approval, false);
  v_reason text := nullif(current_setting('public.set_sole_admin_rpc_reason', true), '');
  v_setting_changed boolean := false;
begin
  if tg_op = 'INSERT' then
    -- Initial FALSE/default FALSE is ordinary company-settings bootstrap and
    -- is not an activation. Initial TRUE is a sensitive activation and must
    -- come through the governed RPC.
    v_setting_changed := v_new_val = true;
  else
    v_old_val := coalesce(old.allow_sole_admin_self_approval, false);
    v_setting_changed := v_old_val is distinct from v_new_val;
  end if;

  if v_setting_changed then
    if nullif(current_setting('public.set_sole_admin_rpc_context', true), '') is distinct from 'active' then
      raise exception 'SOLE_ADMIN_SETTING_DIRECT_WRITE_PROHIBITED: allow_sole_admin_self_approval cannot be mutated directly; must use set_sole_admin_self_approval_atomic RPC.'
        using errcode = '42501';
    end if;

    if v_reason is null or length(btrim(v_reason)) < 4 then
      raise exception 'SOLE_ADMIN_REASON_REQUIRED: a non-empty reason of at least 4 characters is required to change this setting.'
        using errcode = '22023';
    end if;

    insert into public.audit_log (
      user_id,
      action,
      entity,
      entity_id,
      note,
      "table",
      details
    ) values (
      v_actor,
      'COMPANY_SETTING_CHANGE',
      'company_settings',
      new.company_id::text,
      'Sole Admin Self Approval setting ' ||
        case
          when tg_op = 'INSERT' then 'activated from default false to true'
          else 'changed from ' || v_old_val::text || ' to ' || v_new_val::text
        end ||
        ' with reason: ' || v_reason,
      'company_settings',
      jsonb_build_object(
        'field', 'allow_sole_admin_self_approval',
        'old_value', case when tg_op = 'INSERT' then false else v_old_val end,
        'new_value', v_new_val,
        'reason', v_reason,
        'actor', v_actor,
        'company_id', new.company_id,
        'timestamp', now()
      )::text
    );
  end if;

  return new;
end;
$$;

revoke all on function public.wp01_audit_sole_admin_setting_change() from public, anon, authenticated;
grant execute on function public.wp01_audit_sole_admin_setting_change() to service_role;

commit;
