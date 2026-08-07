import { useParams, useRouter } from '@tanstack/react-router';
import { PropertyFormModal } from './property-form-modal';
import { PropertyDetailPage } from './property-detail-page';

/**
 * Property create/edit route surface (Wave A UX simplification).
 *
 * - /properties/new (no propertyId): renders the compact centered 3-step
 *   create modal (PropertyFormModal); closing returns to the portfolio hub.
 * - /properties/$propertyId/edit: renders the property detail workspace with
 *   the compact centered edit modal on top, so editing never leaves the
 *   property context and the user is never thrown into a standalone page.
 *
 * Business logic, validation, and permissions are unchanged — they live in
 * PropertyFormModal (single-pass resolver validation, atomic RPC writes).
 */
export function PropertyFormPage() {
  const params = useParams({ strict: false });
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : undefined;
  return propertyId ? <PropertyEditFormPage propertyId={propertyId} /> : <PropertyCreateRoute />;
}

function PropertyCreateRoute() {
  const router = useRouter();

  return (
    <PropertyFormModal
      open
      onClose={() => {
        void router.navigate({ to: '/properties' });
      }}
    />
  );
}

function PropertyEditFormPage({ propertyId }: Readonly<{ propertyId: string }>) {
  const router = useRouter();

  const closeToDetail = () => {
    void router.navigate({ to: '/properties/$propertyId', params: { propertyId } });
  };

  return (
    <>
      <PropertyDetailPage />
      <PropertyFormModal open propertyId={propertyId} onClose={closeToDetail} />
    </>
  );
}
