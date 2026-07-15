import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const DocumentsVaultPage = lazy(() => import('@/features/documents-vault/documents-vault-page'));

export const Route = createFileRoute('/_protected/documents-vault')({
  component: () => (
    <Suspense fallback={<Skeleton className="m-6 h-96" />}>
      <DocumentsVaultPage />
    </Suspense>
  ),
});
