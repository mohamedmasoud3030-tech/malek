import { useNavigate } from '@tanstack/react-router';
import { PersonFormModal } from '@/features/people/person-form-modal';
import { PeopleListPage } from '@/features/people/people-list-page';
import { useBackgroundLocation } from '@/app/router/background-location';

/**
 * /people/new — quick-create journey.
 *
 * Route-native dialog: internal navigation from /people shows modal over list
 * (background preserved), direct/refresh shows same modal over list (no blank)
 * with close falling back to /people. Business logic unchanged.
 */
export function PersonNewRouteComponent() {
  const navigate = useNavigate();
  const background = useBackgroundLocation();
  const isDialog = background !== null && background.pathname === '/people';
  const closeToDirectory = () => {
    if (isDialog) window.history.back();
    else void navigate({ to: '/people' });
  };

  return (
    <>
      <PeopleListPage />
      <PersonFormModal open onClose={closeToDirectory} />
    </>
  );
}
