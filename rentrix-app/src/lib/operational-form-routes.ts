const operationalFormRoutePrefixes = [
  '/properties',
  '/units',
  '/people',
  '/tenants',
  '/owners',
  '/contracts',
  '/maintenance',
  '/settings',
  '/portfolio',
  '/relationships',
] as const;

export function isOperationalFormRoute(pathname: string): boolean {
  return operationalFormRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
