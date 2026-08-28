-- Harden the public Owner Portal RPC without changing its client contract.
-- The v44 implementation is retained as an internal legacy projection only; external
-- callers keep the canonical function name and receive corrected finance/document data.

begin;

alter function public.get_owner_portal_snapshot(uuid)
  rename to get_owner_portal_snapshot_legacy;

revoke all on function public.get_owner_portal_snapshot_legacy(uuid)
  from public, anon, authenticated;

create function public.get_owner_portal_snapshot(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_base jsonb;
  v_snapshot jsonb;
  v_company uuid;
  v_owner_id uuid;
  v_net_payable numeric := 0;
  v_documents jsonb := '[]'::jsonb;
begin
  -- Reuse the already-hardened token validation and owner/property projection, then
  -- replace the two fields whose canonical semantics changed.
  v_base := public.get_owner_portal_snapshot_legacy(p_token);
  if v_base is null or v_base ->> 'status' <> 'ready' then
    return coalesce(v_base, jsonb_build_object('status', 'invalid'));
  end if;

  select l.company_id, l.owner_id
  into v_company, v_owner_id
  from public.owner_portal_links l
  where l.token = p_token
    and l.revoked_at is null
    and l.expires_at > now()
  limit 1;

  if v_company is null or v_owner_id is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- "netPayable" means the amount still payable now. Paid settlements must never
  -- inflate it; canonical owner-settlement semantics count DRAFT + APPROVED only.
  select coalesce(sum(coalesce(s.net_payable, 0)), 0)
  into v_net_payable
  from public.owner_settlements s
  where s.company_id = v_company
    and s.owner_id = v_owner_id
    and upper(coalesce(s.status::text, '')) in ('DRAFT', 'APPROVED');

  -- Canonical document source is vault_documents. Return metadata only: no storage
  -- path, file URL, signed URL, or bytes ever cross the external portal boundary.
  with owner_property_ids as (
    select po.property_id
    from public.property_owners po
    join public.properties p
      on p.id = po.property_id
     and p.company_id = po.company_id
    where po.company_id = v_company
      and po.owner_id = v_owner_id
      and p.deleted_at is null
      and (po.starts_on is null or po.starts_on <= current_date)
      and (po.ends_on is null or po.ends_on >= current_date)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', vd.id,
    'title', coalesce(nullif(vd.title, ''), vd.file_name, 'مستند'),
    'mime', vd.mime_type,
    'scope', case
      when lower(coalesce(vd.related_entity_type, '')) = 'owner' then 'owner'
      else 'property'
    end,
    'createdAt', vd.created_at
  ) order by vd.created_at desc nulls last, vd.id desc), '[]'::jsonb)
  into v_documents
  from public.vault_documents vd
  where vd.deleted_at is null
    and (
      (
        lower(coalesce(vd.related_entity_type, '')) = 'owner'
        and vd.related_entity_id::text = v_owner_id::text
      )
      or (
        lower(coalesce(vd.related_entity_type, '')) = 'property'
        and exists (
          select 1
          from owner_property_ids opi
          where opi.property_id::text = vd.related_entity_id::text
        )
      )
    );

  v_snapshot := v_base -> 'snapshot';
  v_snapshot := jsonb_set(v_snapshot, '{summary,netPayable}', to_jsonb(v_net_payable), true);
  v_snapshot := jsonb_set(v_snapshot, '{documents}', v_documents, true);

  return jsonb_build_object('status', 'ready', 'snapshot', v_snapshot);
end;
$function$;

revoke all on function public.get_owner_portal_snapshot(uuid)
  from public, anon, authenticated;
grant execute on function public.get_owner_portal_snapshot(uuid)
  to anon, authenticated;

comment on function public.get_owner_portal_snapshot(uuid) is
  'Read-only Owner Portal snapshot. Token scope is server-resolved; payable excludes PAID settlements and documents expose vault metadata only.';

commit;
