// Pure Guardian rule helpers used by scanner regressions.

export function hasCanonicalAuthorityResolver(definition, acceptedResolverCalls) {
  const src = String(definition ?? '');
  return acceptedResolverCalls.some((token) => src.includes(token));
}

export function shouldRequireAdminManagerResolver(row) {
  return Boolean(row.anon_execute || row.authenticated_execute);
}

export function isUsersRoleOperationalAuthority(definition, acceptedResolverCalls) {
  const src = String(definition ?? '').replace(/\s+/g, ' ').trim();
  const looksLikeUsersRole =
    /from\s+public\.users\s+(?:as\s+)?([a-z_][a-z0-9_]*)[\s\S]*?\1\.role(?::text)?\s*(?:=|<>|in\s*\(|=s*any)/i.test(src) ||
    /join\s+public\.users\s+(?:as\s+)?([a-z_][a-z0-9_]*)[\s\S]*?\1\.role(?::text)?\s*(?:=|<>|in\s*\(|=s*any)/i.test(src);
  if (!looksLikeUsersRole) return false;
  return !hasCanonicalAuthorityResolver(definition, acceptedResolverCalls);
}
