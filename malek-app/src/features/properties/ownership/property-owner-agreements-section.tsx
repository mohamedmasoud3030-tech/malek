import { OwnerAgreementsManager } from '@/features/owners/OwnerAgreementsManager';

export function PropertyOwnerAgreementsSection({ propertyId }: Readonly<{ propertyId: string }>) {
  return <OwnerAgreementsManager propertyId={propertyId} />;
}
