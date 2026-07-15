import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const UtilitiesPage = lazy(() => import('@/features/utilities/utilities-page'));

export const Route = createFileRoute('/_protected/utilities')({
  component: () => (
    <Suspense fallback={<Skeleton className="m-6 h-96" />}>
      <UtilitiesPage />
    </Suspense>
  ),
});
