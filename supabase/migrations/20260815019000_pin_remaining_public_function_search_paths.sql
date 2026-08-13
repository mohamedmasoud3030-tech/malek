-- Supabase security-advisor closeout for the two remaining mutable search_path
-- functions. Function bodies and privileges are unchanged.

do $pin$
begin
  if to_regprocedure('public.wp05_cash_accounts()') is not null then
    alter function public.wp05_cash_accounts()
      set search_path = public, pg_temp;
  end if;

  if to_regprocedure(
    'public.format_document_reference(uuid,text,text,integer,bigint)'
  ) is not null then
    alter function public.format_document_reference(uuid, text, text, integer, bigint)
      set search_path = public, pg_temp;
  end if;
end;
$pin$;
