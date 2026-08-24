import { useParams } from '@tanstack/react-router';
import { PersonDetailPage } from '@/features/people/components/PersonDossier';

export function PersonDetailRouteComponent() {
  const { personId = '' } = useParams({ strict: false }) as { personId?: string };
  if (!personId) return null;
  return <PersonDetailPage personId={personId} />;
}
