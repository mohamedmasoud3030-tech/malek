import { useParams } from '@tanstack/react-router';
import { AsyncContentState } from '@/components/async-content-state';
import { useUnits } from '@/features/units/use-units';
import { PropertyFinancialSummaryCard } from '../financial-summary/property-financial-summary-card';
import { PropertyOwnerAgreementsSection } from '../ownership/property-owner-agreements-section';
import { useProperty } from '../use-properties';
import { PropertyIdentityCard, PropertyUnitsSummaryCard } from './property-overview-cards';

export function PropertyOverview() {
  const params = useParams({ strict: false });
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : '';
  const propertyQuery = useProperty(propertyId);
  const unitsQuery = useUnits(propertyId);
  const property = propertyQuery.data;

  return (
    <AsyncContentState
      status={propertyQuery.isLoading ? 'loading' : !property ? 'empty' : 'ready'}
      emptyTitle="العقار غير موجود"
    >
      {property && (
        <div className="space-y-6">
          <PropertyIdentityCard property={property} />
          <PropertyUnitsSummaryCard units={unitsQuery.data ?? []} />
          <PropertyOwnerAgreementsSection propertyId={propertyId} />
          <PropertyFinancialSummaryCard />
        </div>
      )}
    </AsyncContentState>
  );
}
