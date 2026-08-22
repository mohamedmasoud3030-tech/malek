-- Security hardening: make public-schema function EXECUTE fail closed by default.
--
-- SECURITY DEFINER changes current_user to the function owner, so caller authorization
-- must never depend on current_user being a browser/service identity. The effective
-- boundary for internal elevated functions is the function ACL plus the governed
-- browser-facing wrapper RPC that calls them.
--
-- Supabase migrations are owned by postgres in the canonical deployment. Revoke the
-- inherited/default EXECUTE path for browser roles so every future browser-facing RPC
-- must opt in with an explicit GRANT EXECUTE.

begin;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Also apply to the role executing this migration. In normal Supabase replay this is
-- postgres, but keeping both statements makes disposable/local replay fail closed even
-- when the migration runner role differs.
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

-- Re-assert the critical GL engine boundary. These are internal posting primitives;
-- browser-facing SECURITY DEFINER orchestration may invoke them as the definer, but
-- anon/authenticated must never be able to invoke them directly.
revoke all on function public.post_journal_event(jsonb) from public, anon, authenticated;
revoke all on function public.gl_create_journal_batch(jsonb) from public, anon, authenticated;
revoke all on function public.gl_post_journal_batch(uuid) from public, anon, authenticated;
revoke all on function public.reverse_journal_batch(uuid) from public, anon, authenticated;

grant execute on function public.post_journal_event(jsonb) to service_role;
grant execute on function public.gl_create_journal_batch(jsonb) to service_role;
grant execute on function public.gl_post_journal_batch(uuid) to service_role;
grant execute on function public.reverse_journal_batch(uuid) to service_role;

-- Behavioral proof of the new default. A function created after the ALTER DEFAULT
-- PRIVILEGES statements must not become callable by browser roles merely because it
-- exists in public.
create function public.__default_function_acl_probe()
returns boolean
language sql
stable
as $$ select true $$;

do $verify_default_acl$
begin
  if has_function_privilege('anon', 'public.__default_function_acl_probe()', 'EXECUTE') then
    raise exception 'DEFAULT_FUNCTION_ACL_UNSAFE: anon inherited EXECUTE on a new public function'
      using errcode = '42501';
  end if;

  if has_function_privilege('authenticated', 'public.__default_function_acl_probe()', 'EXECUTE') then
    raise exception 'DEFAULT_FUNCTION_ACL_UNSAFE: authenticated inherited EXECUTE on a new public function'
      using errcode = '42501';
  end if;

  if has_function_privilege('anon', 'public.post_journal_event(jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.post_journal_event(jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.gl_create_journal_batch(jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.gl_create_journal_batch(jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.gl_post_journal_batch(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.gl_post_journal_batch(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.reverse_journal_batch(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.reverse_journal_batch(uuid)', 'EXECUTE') then
    raise exception 'GL_ENGINE_BROWSER_EXECUTE_OPEN: internal GL engine ACL is not fail closed'
      using errcode = '42501';
  end if;
end
$verify_default_acl$;

drop function public.__default_function_acl_probe();

comment on function public.post_journal_event(jsonb) is
  'Internal GL posting primitive. Service-role/direct ACL only; SECURITY DEFINER current_user is owner identity and is not caller authorization.';
comment on function public.gl_create_journal_batch(jsonb) is
  'Internal GL batch primitive. Service-role/direct ACL only; SECURITY DEFINER current_user is owner identity and is not caller authorization.';
comment on function public.gl_post_journal_batch(uuid) is
  'Internal GL posting primitive. Service-role/direct ACL only; SECURITY DEFINER current_user is owner identity and is not caller authorization.';
comment on function public.reverse_journal_batch(uuid) is
  'Internal GL reversal primitive. Service-role/direct ACL only; SECURITY DEFINER current_user is owner identity and is not caller authorization.';

commit;
