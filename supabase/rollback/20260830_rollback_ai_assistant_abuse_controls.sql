-- Manual emergency rollback — not auto-applied; run by hand only after review.
-- Rollback for: 20260830020000_ai_assistant_abuse_controls.sql
-- Removes only ephemeral quota counters; no business or financial history is stored here.

begin;
drop function if exists public.consume_ai_assistant_quota_atomic(integer,integer);
drop table if exists public.ai_assistant_rate_limits;
commit;
