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
  description: string;
  permission: AppPermission;
  icon: typeof ShieldCheck;
}>;

const governanceLinks: readonly GovernanceLink[] = [
  { to: '/audit-log', title: 'سجل التدقيق', description: 'عرض أحداث الحوكمة قراءة فقط — لا يُعدَّل أي سجل.', permission: 'audit.view', icon: ListChecks },
  { to: '/data-integrity', title: 'سلامة البيانات', description: 'تشغيل فحوصات قراءة فقط على العلاقات الأساسية في المخطط.', permission: 'integrity.view', icon: SearchCheck },
  { to: '/change-password', title: 'تغيير كلمة المرور', description: 'تحديث كلمة مرور حسابك الحالي بأمان.', permission: 'auth.password.change', icon: KeyRound },
  { to: '/settings', title: 'إعدادات الشركة', description: 'إدارة إعدادات العملة واللغة والمعلومات التجارية.', permission: 'settings.manage', icon: Settings },
];

const governancePrinciples = [
  { label: 'نموذج الصلاحيات', value: 'يفشل مغلقاً', description: 'الوصول محجوب افتراضياً' },
  { label: 'التدقيق', value: 'قراءة فقط', description: 'لا كتابة عبر الواجهة' },
  { label: 'سلامة البيانات', value: 'بلا RPC', description: 'استعلامات SQL مباشرة' },
  { label: 'المخطط', value: 'بلا تغيير', description: 'لا DDL من الواجهة' },
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
              <Card key={item.to} className="rounded-2xl transition-shadow hover:shadow-card-hover">
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
                  <Button asChild variant="secondary">
                    <Link to={item.to}>فتح</Link>
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
        description="مركز وصول آمن للوظائف النظامية. جميع العمليات هنا قراءة فقط أو محدودة الصلاحية."
      />
      {body}
    </PageLayout>
  );
}

/** Standalone /system route entry point — preserves historical behavior exactly. */
export function SystemPage() {
  return <SystemWorkspace variant="standalone" />;
}
