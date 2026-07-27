begin;

-- Security hardening is deliberately forward-only. In an emergency, disable
-- property creation in the client while correcting data; never restore the
-- vulnerable cross-company owner lookup.

commit;
