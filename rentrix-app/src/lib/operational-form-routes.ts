const operationalFormRoutePrefixes = [
  '/properties',
  '/units',
  '/people',
  '/tenants',
  '/owners',
  '/contracts',
  '/maintenance',
  '/settings',
  '/system',
  '/audit-log',
  '/data-integrity',
  '/utilities',
  '/automation',
  '/documents-vault',
  '/ai-assistant',
  '/communication',
  '/portfolio',
  '/relationships',
  '/change-password',
] as const;

export function isOperationalFormRoute(pathname: string): boolean {
  return operationalFormRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
