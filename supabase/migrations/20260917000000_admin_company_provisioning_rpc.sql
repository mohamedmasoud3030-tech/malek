create or replace function public.create_company_for_existing_user(
  p_name text,
  p_slug text,
  p_user_id uuid,
  p_currency text default 'OMR',
  p_locale text default 'ar-OM',
  p_timezone text default 'Asia/Muscat'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_user_id uuid;
  v_slug text;
  v_name text;
  v_currency text;
  v_locale text;
  v_timezone text;
begin
  if not public.is_admin() then
    raise exception 'COMPANY_PROVISION_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  v_name := btrim(p_name);
  v_slug := lower(regexp_replace(btrim(p_slug), '[^a-z0-9]+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
  v_user_id := p_user_id;
  v_currency := upper(coalesce(nullif(btrim(p_currency), ''), 'OMR'));
  v_locale := coalesce(nullif(btrim(p_locale), ''), 'ar-OM');
  v_timezone := coalesce(nullif(btrim(p_timezone), ''), 'Asia/Muscat');

  if v_name is null or v_name = '' then
    raise exception 'COMPANY_NAME_REQUIRED' using errcode = '22023';
  end if;
  if v_slug is null or v_slug = '' then
    raise exception 'COMPANY_SLUG_REQUIRED' using errcode = '22023';
  end if;
  if v_user_id is null then
    raise exception 'COMPANY_ADMIN_USER_REQUIRED' using errcode = '22023';
  end if;
  if not exists (select 1 from public.users u where u.id = v_user_id and u.is_active and u.deleted_at is null) then
    raise exception 'COMPANY_ADMIN_USER_NOT_FOUND' using errcode = '23503';
  end if;
  if exists (select 1 from public.company_members cm where cm.user_id = v_user_id) then
    raise exception 'COMPANY_ADMIN_USER_ALREADY_ASSIGNED' using errcode = '23505';
  end if;
  if exists (select 1 from public.companies c where c.slug = v_slug) then
    raise exception 'COMPANY_SLUG_ALREADY_EXISTS' using errcode = '23505';
  end if;

  insert into public.companies (name, slug, currency, locale, timezone, is_active)
  values (v_name, v_slug, v_currency, v_locale, v_timezone, true)
  returning id into v_company_id;

  insert into public.company_members (company_id, user_id, role, is_active)
  values (v_company_id, v_user_id, 'ADMIN', true);

  insert into public.company_settings (
    company_id, company_name, currency, locale, timezone
  )
  values (
    v_company_id, v_name, v_currency, v_locale, v_timezone
  );

  perform public.provision_company_chart_of_accounts(v_company_id);

  return jsonb_build_object(
    'company_id', v_company_id,
    'user_id', v_user_id,
    'name', v_name,
    'slug', v_slug,
    'currency', v_currency,
    'locale', v_locale,
    'timezone', v_timezone
  );
exception
  when unique_violation then
    raise exception 'COMPANY_PROVISION_CONFLICT' using errcode = '23505';
end;
$$;

revoke all on function public.create_company_for_existing_user(text, text, uuid, text, text, text) from public;
revoke all on function public.create_company_for_existing_user(text, text, uuid, text, text, text) from anon;
grant execute on function public.create_company_for_existing_user(text, text, uuid, text, text, text) to authenticated;
