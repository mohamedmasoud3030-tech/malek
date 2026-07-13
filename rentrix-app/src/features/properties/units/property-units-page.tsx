import { useParams } from '@tanstack/react-router';
import { UnitsList } from '@/features/units/units-list';
import { useUnits } from '@/features/units/use-units';

export function PropertyUnitsPage() {
  const params = useParams({ strict: false });
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : '';
  const unitsQuery = useUnits(propertyId);

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <UnitsList propertyId={propertyId} unitsQuery={unitsQuery} />
    </div>
  );
}
