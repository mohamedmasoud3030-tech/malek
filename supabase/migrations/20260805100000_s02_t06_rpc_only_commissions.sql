-- S02-T06: block direct browser mutations on commissions; RPC only
REVOKE INSERT, UPDATE, DELETE ON public.commissions FROM authenticated;
REVOKE ALL ON public.commissions FROM anon, public;
