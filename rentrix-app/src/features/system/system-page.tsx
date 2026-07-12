import { Link } from '@tanstack/react-router';
import { KeyRound, ListChecks, SearchCheck, Settings, ShieldCheck } from 'lucide-react';
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

export function SystemPage() {
  const { authorization } = useAuth();
  const visibleLinks = governanceLinks.filter((item) => canAccess(authorization, item.permission));

  return (
    <section className="space-y-6" dir="rtl">
      {/* Governance principles banner */}
      <Card className="overflow-hidden">
        <div className="h-1.5 bg-primary" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="size-5 text-primary" />
            النظام والحوكمة
          </CardTitle>
          <CardDescription>
            مركز وصول آمن للوظائف النظامية. جميع العمليات هنا قراءة فقط أو محدودة الصلاحية.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveCardGrid desktopColumns={4}>
            {governancePrinciples.map((p) => (
              <div key={p.label} className="rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-bold text-muted-foreground">{p.label}</p>
                <p className="mt-1 text-lg font-black">{p.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
              </div>
            ))}
          </ResponsiveCardGrid>
        </CardContent>
      </Card>

      {/* Navigation cards */}
      {visibleLinks.length === 0 ? (
        <div className="rounded-2xl border border-border bg-muted/20 px-6 py-10 text-center text-muted-foreground text-sm">
          لا توجد وظائف نظامية متاحة لصلاحياتك الحالية.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.to} className="rounded-2xl transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="size-5 text-primary" />
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
    </section>
  );
}
