import { Link } from '@tanstack/react-router';
import { KeyRound, ListChecks, SearchCheck, Settings, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Button } from '@/components/ui/button';
import { canAccess, type AppPermission } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';

type GovernanceLink = Readonly<{
  to: string;
  title: string;
  search?: Record<string, string>;
  description: string;
  permission: AppPermission;
  icon: typeof ShieldCheck;
}>;

const governanceLinks: readonly GovernanceLink[] = [
  { to: '/admin-support', title: 'عمليات الدعم والتحقيق', description: 'طلبات الدعم ومراجعة الحالات حسب صلاحياتك.', permission: 'support.operations.view', icon: ShieldCheck },
  { to: '/settings', search: { section: 'audit-log' }, title: 'سجل التدقيق', description: 'راجع الأحداث المسجلة دون تعديلها.', permission: 'audit.view', icon: ListChecks },
  { to: '/settings', search: { section: 'data-integrity' }, title: 'سلامة البيانات', description: 'افحص ترابط البيانات الأساسية دون تغييرها.', permission: 'integrity.view', icon: SearchCheck },
  { to: '/settings', search: { section: 'security' }, title: 'تغيير كلمة المرور', description: 'حدّث كلمة مرور حسابك الحالي.', permission: 'auth.password.change', icon: KeyRound },
  { to: '/settings', search: { section: 'company' }, title: 'إعدادات الشركة', description: 'إدارة العملة واللغة والمعلومات التجارية.', permission: 'company.settings.manage', icon: Settings },
];

const governancePrinciples = [
  { label: 'الصلاحيات', value: 'محمي افتراضياً', description: 'تظهر فقط الوظائف المسموح لك بها' },
  { label: 'سجل التدقيق', value: 'للمراجعة فقط', description: 'لا يمكن تغيير الأحداث المسجلة' },
  { label: 'سلامة البيانات', value: 'فحوصات آمنة', description: 'تتحقق من الترابط دون تعديل البيانات' },
  { label: 'إعدادات النظام', value: 'محمية', description: 'التغييرات الحساسة محدودة بالصلاحيات' },
] as const;

export type SystemWorkspaceVariant = 'standalone' | 'embedded';

type SystemWorkspaceProps = Readonly<{
  /**
   * 'standalone' (default) preserves the historical /system route: content
   * renders inside its own PageLayout + PageHeader. 'embedded' drops both
   * so the content can be hosted inside the governance hub without
   * duplicating page chrome.
   */
  variant?: SystemWorkspaceVariant;
}>;

export function SystemWorkspace({ variant = 'standalone' }: SystemWorkspaceProps = {}) {
  const { authorization } = useAuth();
  const visibleLinks = governanceLinks.filter((item) => canAccess(authorization, item.permission));

  const body = (
    <>
      <ResponsiveCardGrid desktopColumns={4}>
        {governancePrinciples.map((principle) => (
          <Card key={principle.label} variant="muted">
            <CardContent className="p-4">
              <p className="text-xs font-bold text-muted-foreground">{principle.label}</p>
              <p className="mt-1 text-lg font-black">{principle.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{principle.description}</p>
            </CardContent>
          </Card>
        ))}
      </ResponsiveCardGrid>

      {visibleLinks.length === 0 ? (
        <div className="rounded-2xl border border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
          لا توجد وظائف نظامية متاحة لصلاحياتك الحالية.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={`${item.to}:${item.title}`} className="rounded-2xl transition-shadow hover:shadow-card-hover">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    {item.title}
                  </CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="secondary" className="min-h-11">
                    <Link to={item.to} search={item.search}>فتح</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );

  if (variant === 'embedded') {
    return <div className="space-y-5">{body}</div>;
  }

  return (
    <PageLayout dir="rtl" lang="ar">
      <PageHeader
        title="النظام والحوكمة"
        description="مركز وصول للوظائف الإدارية والحساسة حسب صلاحياتك."
      />
      {body}
    </PageLayout>
  );
}

/** Standalone /system route entry point — preserves historical behavior exactly. */
export function SystemPage() {
  return <SystemWorkspace variant="standalone" />;
}