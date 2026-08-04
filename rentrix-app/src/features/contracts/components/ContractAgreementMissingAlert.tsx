import { AlertTriangle, ArrowRightLeft, FileCheck } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Property } from '@/types/domain';

export interface ContractAgreementMissingAlertProps {
  readonly property: Pick<Property, 'id' | 'title'> | undefined;
  readonly startDate: string;
  readonly endDate: string;
  readonly isLoading: boolean;
  readonly hasError: boolean;
  readonly hasSelectedPeriod: boolean;
  readonly hasAgreement: boolean;
  readonly onRetry?: () => void;
}

/**
 * UX-041: Replaces the dead-end text "انتقل إلى صفحة العقار" with an actionable
 * recovery surface that explains what is missing and provides direct navigation
 * to the property Ownership & Agreements tab, plus a secondary action to
 * change the selected property or dates.
 */
export function ContractAgreementMissingAlert({
  property,
  startDate,
  endDate,
  isLoading,
  hasError,
  hasSelectedPeriod,
  hasAgreement,
  onRetry,
}: ContractAgreementMissingAlertProps) {
  // Success state — agreement found
  if (hasAgreement) {
    return (
      <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-emerald-800 dark:text-emerald-200">
          <FileCheck className="size-5 shrink-0" />
          <span className="font-semibold">
            تم تحديد اتفاقية تشغيل المالك تلقائياً. العقد مغطى طوال فترة السريان.
          </span>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className="border-muted bg-muted/30">
        <CardContent className="p-4 text-sm text-muted-foreground">
          جارٍ التحقق من اتفاقية تشغيل المالك...
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (hasError) {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40" role="alert">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="size-5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">تعذر التحقق من اتفاقية المالك.</p>
            {onRetry && (
                <Button variant="ghost" size="sm" className="h-auto p-0 text-amber-700 dark:text-amber-300" onClick={onRetry}>
                إعادة المحاولة
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // No period selected yet — prompting state
  if (!hasSelectedPeriod) {
    return (
      <Card className="border-muted bg-muted/30">
        <CardContent className="p-4 text-sm text-muted-foreground">
          اختر العقار وتواريخ العقد للتحقق الآلي من اتفاقية المالك.
        </CardContent>
      </Card>
    );
  }

  // Missing agreement — actionable recovery
  const propertyTabPath = property
    ? `/properties/$propertyId`
    : '/properties';
  const propertyTabParams = property ? { propertyId: property.id } : undefined;
  const propertyTabSearch = { tab: 'ownership' as const };

  return (
    <Card className="border-destructive/30 bg-destructive/5" role="alert">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="size-5 shrink-0" />
          لا توجد اتفاقية إدارة تغطي كامل فترة العقد
        </CardTitle>
        <CardDescription className="text-destructive/80">
          يجب إنشاء اتفاقية إدارة فعالة للمالك لتغطية الفترة من{' '}
          <span className="font-bold text-destructive">{startDate}</span> إلى{' '}
          <span className="font-bold text-destructive">{endDate}</span> قبل حفظ العقد.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {property && (
          <p className="text-sm text-muted-foreground">
            العقار المحدد:{' '}
            <span className="font-bold text-foreground">{property.title}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {property ? (
            <Button asChild>
              <Link
                to={propertyTabPath}
                params={propertyTabParams}
                search={propertyTabSearch}
              >
                <FileCheck className="me-2 size-4" />
                فتح اتفاقيات العقار
              </Link>
            </Button>
          ) : (
            <Button asChild variant="secondary">
              <Link to="/properties">
                <FileCheck className="me-2 size-4" />
                الذهاب للعقارات
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to={property ? propertyTabPath : '/properties'} params={propertyTabParams} search={{}}>
              <ArrowRightLeft className="me-2 size-4" />
              تغيير العقار أو التواريخ
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          سيتم فتح صفحة العقار في تبويب «الملكية واتفاقيات التشغيل». بعد إنشاء أو تحديث الاتفاقية، عد
          إلى نموذج العقد لإكمال الحفظ.
        </p>
      </CardContent>
    </Card>
  );
}
