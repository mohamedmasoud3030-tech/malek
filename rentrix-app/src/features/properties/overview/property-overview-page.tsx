import { useParams } from '@tanstack/react-router';
import { AsyncContentState } from '@/components/async-content-state';
import { useProperty } from '../use-properties';
import { PropertyOwnerAgreementsSection } from '../ownership/property-owner-agreements-section';
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
          <PropertyDossierContent propertyId={propertyId} />
          <PropertyOwnerAgreementsSection propertyId={propertyId} />
        </div>
      )}
    </AsyncContentState>
  );
}
