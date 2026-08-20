-- Manual emergency rollback; not auto-applied.
-- Rollback for 20260901000000_ai_assistant_budget_idempotency.sql.
-- Removes ephemeral AI budget reservations only; no business history is stored here.

begin;
drop function if exists public.reserve_ai_assistant_budget_atomic(uuid, bigint, integer, bigint);
drop function if exists public.authorize_ai_assistant_access();
drop table if exists public.ai_assistant_budget_reservations;
commit;
