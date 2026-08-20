-- The public.is_admin_or_manager() and public.is_app_user() wrapper functions
-- delegate to app_private.* but were missing EXECUTE grants to `authenticated`,
-- even though the app_private originals have the grant. This silently broke
-- every RLS policy referencing the public wrapper (permission denied for function),
-- blocking all access to: commissions, communication_records, contract_documents,
-- cost_centers, lands, leads, owner_agreements, payment_terms_templates.
grant execute on function public.is_admin_or_manager() to authenticated;
grant execute on function public.is_app_user() to authenticated;
