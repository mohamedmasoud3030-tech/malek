import { useNavigate, useParams } from '@tanstack/react-router';
import { PersonFormModal } from '@/features/people/person-form-modal';
import { PeopleListPage } from '@/features/people/people-list-page';

/**
 * /people/$personId/edit — quick-edit journey.
 *
 * Wave A (UX simplification): the edit surface is the same compact centered
 * modal used by the directory (PersonFormModal), rendered over the people
 * workspace instead of a standalone full page. The user never loses the
 * directory context; cancel/close returns to it directly.
 */
export function PersonEditRouteComponent() {
  const { personId } = useParams({ strict: false }) as { personId: string };
  const navigate = useNavigate();
  const closeToDirectory = () => {
    void navigate({ to: '/people' });
  };

  if (!personId) {
    return <PeopleListPage />;
  }

  return (
    <>
      <PeopleListPage />
      <PersonFormModal open personId={personId} onClose={closeToDirectory} />
    </>
  );
}
