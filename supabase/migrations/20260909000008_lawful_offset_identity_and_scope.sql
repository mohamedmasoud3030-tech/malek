-- FIN-007/008/013/016/019, SEC-001/002; GAP-008.
-- Separate offset operations must not share one journal-event identity.
-- A named agreement cannot confer another owner's/property's offset right.
-- Existing request caches, posted records, amounts, ACLs and ordering stay intact.
begin;
do $repair$
declare v record; v_definition text;
begin
  for v in select * from (values
    ('public.offset_owner_receivable_atomic(jsonb)',
     '''event_id'', ''offset''',
     '''event_id'', ''offset:'' || v_request_id'),
    ('public.create_owner_receivable_atomic(jsonb)',
     'and av.company_id = v_company_id',
     'and av.company_id = v_company_id
       and oa.owner_id = v_owner_id
       and (v_property_id is null or oa.property_id::text = v_property_id)')
  ) patches(signature,old_text,new_text)
  loop
    if not exists(select 1 from pg_proc where oid=v.signature::regprocedure and prosecdef) then
      raise exception 'LAWFUL_OFFSET_BOUNDARY_PRECONDITION: %',v.signature;
    end if;
    v_definition:=pg_get_functiondef(v.signature::regprocedure);
    if (length(v_definition)-length(replace(v_definition,v.old_text,'')))/length(v.old_text)<>1 then
      raise exception 'LAWFUL_OFFSET_DEFINITION_PRECONDITION: %',v.signature;
    end if;
    execute replace(v_definition,v.old_text,v.new_text);
  end loop;
end;
$repair$;
commit;
