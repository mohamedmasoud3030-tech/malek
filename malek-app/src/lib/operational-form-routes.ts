const operationalFormRoutePrefixes = [
  '/dashboard',
  '/properties',
  '/people',
  '/tenants',
  '/owners',
  '/contracts',
  '/maintenance',
  '/settings',
  '/ai-assistant',
  '/help',
  '/admin-support',
  '/communication',
] as const;

export function isOperationalFormRoute(pathname: string): boolean {
  return operationalFormRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
