import { Link, useParams } from '@tanstack/react-router';
import { BarChart3 } from 'lucide-react';
import { AsyncContentState } from '@/components/async-content-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useProperty } from '../use-properties';
import { PropertyOwnerAgreementsSection } from '../ownership/property-owner-agreements-section';
import { PropertyOnboardingReadinessBanner } from '../ownership/property-onboarding-readiness';
import { PropertyDossierContent } from '../components/property-dossier-content';

export function PropertyOverview() {
  const params = useParams({ strict: false });
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : '';
  const propertyQuery = useProperty(propertyId);
  const property = propertyQuery.data;

  return (
    <AsyncContentState
      status={propertyQuery.isLoading ? 'loading' : !property ? 'empty' : 'ready'}
      emptyTitle="العقار غير موجود"
    >
      {property && (
        <div className="space-y-6">
          <PropertyOnboardingReadinessBanner propertyId={propertyId} />

          <PropertyDossierContent propertyId={propertyId} />

          <Card className="border-primary/15 bg-primary/5" data-property-report-link>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-black">
                  <BarChart3 className="size-4 text-primary" aria-hidden="true" />
                  تقرير أداء العقار
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  افتح التحليل الكامل للإشغال والمصروفات وأداء هذا العقار داخل مركز التقارير.
                </p>
              </div>
              <Button asChild variant="outline" className="min-h-11 shrink-0">
                <Link
                  to="/reports"
                  search={{ section: 'analytics', view: 'property_analytics', propertyId } as never}
                >
                  عرض التقرير الكامل
                </Link>
              </Button>
            </CardContent>
          </Card>

          <PropertyOwnerAgreementsSection propertyId={propertyId} />
        </div>
      )}
    </AsyncContentState>
  );
}
