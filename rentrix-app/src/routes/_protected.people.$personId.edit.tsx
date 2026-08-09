import { useNavigate, useParams } from '@tanstack/react-router';
import { PersonFormModal } from '@/features/people/person-form-modal';
import { PeopleListPage } from '@/features/people/people-list-page';
import { useBackgroundLocation } from '@/app/router/background-location';

/**
 * /people/$personId/edit — quick-edit journey.
 *
 * Route-native dialog: internal from /people shows modal over list,
 * direct/refresh shows same modal over list (no blank) with fallback to /people.
 */
export function PersonEditRouteComponent() {
  const { personId } = useParams({ strict: false }) as { personId: string };
  const navigate = useNavigate();
  const background = useBackgroundLocation();
  const isDialog = background !== null && background.pathname === '/people';
  const closeToDirectory = () => {
    if (isDialog) window.history.back();
    else void navigate({ to: '/people' });
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
