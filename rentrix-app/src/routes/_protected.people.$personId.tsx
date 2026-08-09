import { useParams } from '@tanstack/react-router';
import { useBackgroundLocation } from '@/app/router/background-location';
import { PeopleListPage } from '@/features/people/people-list-page';
import { PersonDetailPage, PersonPreviewDialog } from '@/features/people/components/PersonDossier';

export function PersonDetailRouteComponent() {
  const { personId = '' } = useParams({ strict: false }) as { personId?: string };
  const background = useBackgroundLocation();
  const isDialog = background !== null;
  if (!personId) return null;
  if (!isDialog) return <PersonDetailPage personId={personId} />;
  return (
    <>
      <PeopleListPage embedded />
      <PersonPreviewDialog personId={personId} open onOpenChange={(open) => { if (!open) window.history.back(); }} />
    </>
  );
}
