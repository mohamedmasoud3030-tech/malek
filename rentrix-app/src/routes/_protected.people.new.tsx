import { useNavigate } from '@tanstack/react-router';
import { PersonFormModal } from '@/features/people/person-form-modal';
import { PeopleListPage } from '@/features/people/people-list-page';

/**
 * /people/new — quick-create journey.
 *
 * Wave A (UX simplification): this route no longer renders a standalone
 * full-page form. It renders the people directory workspace with the compact
 * centered create modal on top, so the user keeps workspace context and lands
 * back in the directory on close/cancel. Business logic, validation, and
 * permissions are unchanged — they live in PersonFormModal.
 */
export function PersonNewRouteComponent() {
  const navigate = useNavigate();
  const closeToDirectory = () => {
    void navigate({ to: '/people' });
  };

  return (
    <>
      <PeopleListPage />
      <PersonFormModal open onClose={closeToDirectory} />
    </>
  );
}
