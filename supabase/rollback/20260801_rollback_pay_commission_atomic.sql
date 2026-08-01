-- Rollback for 20260801000002_pay_commission_atomic.sql
begin;
drop function if exists public.pay_commission_atomic(jsonb);
drop function if exists public.reverse_commission_atomic(jsonb);
commit;
