import { useParams } from '@tanstack/react-router';
import { PropertyUnitDetailPage } from '@/features/properties/units/property-unit-detail-page';

export function PropertyUnitDetailRouteComponent() {
  const params = useParams({ strict: false }) as Record<string, string | undefined>;
  const unitId = params.unitId ?? '';
  if (!unitId) return null;
  return <PropertyUnitDetailPage />;
}
