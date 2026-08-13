-- Supabase security-advisor closeout for the two remaining mutable search_path
-- functions. Function bodies and privileges are unchanged.

alter function public.wp05_cash_accounts()
  set search_path = public, pg_temp;

alter function public.format_document_reference(uuid, text, text, integer, bigint)
  set search_path = public, pg_temp;
