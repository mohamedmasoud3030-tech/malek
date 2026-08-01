-- Rollback for 20260801000001_authoritative_property_ownership_view.sql
begin;
drop view if exists public.current_property_ownership;
commit;
