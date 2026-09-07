import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { APP_BRAND_NAME } from '@/lib/brand';

/**
 * Legacy path recovery at the not-found boundary.
 *
 * The canonical-route retirement (see route-contract.ts: every capability
 * has exactly ONE canonical route; duplicate legacy routes and redirect
 * stubs are not registered) left a handful of well-known pre-unification
 * URLs landing on the generic not-found card. Stale bookmarks, shared
 * links and external notes deserve better: this map sends them to the
 * workspace that owns the capability today — without registering any
 * route-tree stub, keeping the route contract intact.
 *
 * Destinations are verified canonical workspaces:
 *   /units           → /properties?section=units
 *   /accounting      → /reports           (accounting reports authority)
 *   /documents-vault → /maintenance?section=documents_vault
 *   /automation      → /settings?section=automation
 *   /audit-log       → /settings?section=audit-log
 */
export interface LegacyRedirectTarget {
  to: string;
  search?: Record<string, string>;
}

export const LEGACY_ROUTE_REDIRECTS: Readonly<Record<string, LegacyRedirectTarget>> = {
  '/units': { to: '/properties', search: { section: 'units' } },
  '/accounting': { to: '/reports' },
  '/documents-vault': { to: '/maintenance', search: { section: 'documents_vault' } },
  '/automation': { to: '/settings', search: { section: 'automation' } },
  '/audit-log': { to: '/settings', search: { section: 'audit-log' } },
};

export function resolveLegacyRedirect(pathname: string): LegacyRedirectTarget | null {
  return LEGACY_ROUTE_REDIRECTS[pathname] ?? null;
}

export function NotFoundPage() {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const legacyTarget = resolveLegacyRedirect(pathname);

  useEffect(() => {
    if (!legacyTarget) return;
    void navigate({
      to: legacyTarget.to,
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        ...(legacyTarget.search ?? {}),
      }),
      replace: true,
    });
  }, [legacyTarget, navigate]);

  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <Card className="w-full min-w-0 max-w-lg text-center">
        <CardHeader>
          <CardTitle>الصفحة غير موجودة</CardTitle>
          <CardDescription>
            {legacyTarget
              ? 'جارٍ نقلك تلقائيًا إلى الموقع الجديد لهذه الصفحة…'
              : `المسار المطلوب غير متاح في بنية ${APP_BRAND_NAME} الجديدة.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="min-h-11"><Link to="/dashboard">العودة للوحة التحكم</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
