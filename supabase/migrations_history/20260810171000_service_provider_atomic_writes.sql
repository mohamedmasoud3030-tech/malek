-- Atomic Service Provider create/update + category assignment writes.
-- Keeps the browser from coordinating multi-table provider/category mutations.
begin;

create function public.save_service_provider_atomic(
  p_provider_id uuid,
  p_payload jsonb,
  p_category_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_provider public.service_providers;
  v_name text := btrim(coalesce(p_payload ->> 'name', ''));
  v_category_ids uuid[];
  v_requested_category_count integer;
  v_valid_category_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.current_user_has_effective_app_permission('service_providers.write') then
    raise exception 'Service provider write permission required' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'Service provider name is required' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct category_id order by category_id), '{}'::uuid[])
  into v_category_ids
  from unnest(coalesce(p_category_ids, '{}'::uuid[])) category_id;
  v_requested_category_count := cardinality(v_category_ids);

  select count(*)::integer into v_valid_category_count
  from public.service_provider_categories category
  where category.company_id = v_company_id
    and category.id = any(v_category_ids)
    and category.is_active
    and category.deleted_at is null;
  if v_requested_category_count <> v_valid_category_count then
    raise exception 'One or more service categories are unavailable for the active company' using errcode = '23503';
  end if;

  if p_provider_id is null then
    insert into public.service_providers(
      company_id, name, legal_name, registration_number, tax_number,
      contact_name, phone, alternate_phone, email, website, address,
      service_area, availability_notes, notes, is_active
    ) values (
      v_company_id,
      v_name,
      nullif(btrim(coalesce(p_payload ->> 'legal_name', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'registration_number', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'tax_number', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'contact_name', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'phone', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'alternate_phone', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'email', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'website', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'address', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'service_area', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'availability_notes', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'notes', '')), ''),
      coalesce((p_payload ->> 'is_active')::boolean, true)
    ) returning * into v_provider;
  else
    select * into v_provider
    from public.service_providers provider
    where provider.id = p_provider_id
      and provider.company_id = v_company_id
      and provider.deleted_at is null
    for update;
    if not found then
      raise exception 'Service provider not found' using errcode = 'P0002';
    end if;

    update public.service_providers
    set name = v_name,
        legal_name = nullif(btrim(coalesce(p_payload ->> 'legal_name', '')), ''),
        registration_number = nullif(btrim(coalesce(p_payload ->> 'registration_number', '')), ''),
        tax_number = nullif(btrim(coalesce(p_payload ->> 'tax_number', '')), ''),
        contact_name = nullif(btrim(coalesce(p_payload ->> 'contact_name', '')), ''),
        phone = nullif(btrim(coalesce(p_payload ->> 'phone', '')), ''),
        alternate_phone = nullif(btrim(coalesce(p_payload ->> 'alternate_phone', '')), ''),
        email = nullif(btrim(coalesce(p_payload ->> 'email', '')), ''),
        website = nullif(btrim(coalesce(p_payload ->> 'website', '')), ''),
        address = nullif(btrim(coalesce(p_payload ->> 'address', '')), ''),
        service_area = nullif(btrim(coalesce(p_payload ->> 'service_area', '')), ''),
        availability_notes = nullif(btrim(coalesce(p_payload ->> 'availability_notes', '')), ''),
        notes = nullif(btrim(coalesce(p_payload ->> 'notes', '')), ''),
        is_active = coalesce((p_payload ->> 'is_active')::boolean, is_active)
    where id = v_provider.id
      and company_id = v_company_id
    returning * into v_provider;
  end if;

  delete from public.service_provider_category_links link
  where link.company_id = v_company_id
    and link.service_provider_id = v_provider.id
    and not (link.category_id = any(v_category_ids));

  insert into public.service_provider_category_links(company_id, service_provider_id, category_id)
  select v_company_id, v_provider.id, category_id
  from unnest(v_category_ids) category_id
  on conflict (company_id, service_provider_id, category_id) do nothing;

  return jsonb_build_object(
    'provider', to_jsonb(v_provider),
    'category_ids', to_jsonb(v_category_ids)
  );
end;
$$;

create function public.archive_service_provider_atomic(p_provider_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_provider public.service_providers;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.current_user_has_effective_app_permission('service_providers.write') then
    raise exception 'Service provider write permission required' using errcode = '42501';
  end if;

  update public.service_providers provider
  set is_active = false,
      deleted_at = now()
  where provider.id = p_provider_id
    and provider.company_id = v_company_id
    and provider.deleted_at is null
  returning * into v_provider;
  if not found then
    raise exception 'Service provider not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('provider_id', v_provider.id, 'archived', true);
end;
$$;

revoke all on function public.save_service_provider_atomic(uuid,jsonb,uuid[]) from public, anon;
revoke all on function public.archive_service_provider_atomic(uuid) from public, anon;
grant execute on function public.save_service_provider_atomic(uuid,jsonb,uuid[]) to authenticated;
grant execute on function public.archive_service_provider_atomic(uuid) to authenticated;

commit;
