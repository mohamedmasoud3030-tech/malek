import { useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ContractPreviewDialog } from '@/features/contracts/components/ContractPreviewDialog';
import { OwnerPreviewDialog } from '@/features/owners/components/OwnerPreviewDialog';
import { PropertyPreviewDialog } from '@/features/properties/components/PropertyPreviewDialog';
import { UnitPreviewDialog } from '@/features/units/components/UnitPreviewDialog';
import { subscribeEntityPreview, type EntityPreviewKind, type EntityPreviewRequest } from './entity-preview-events';

const previewKinds = new Set<EntityPreviewKind>(['property', 'unit', 'contract', 'owner']);

export function EntityPreviewHost() {
  const [request, setRequest] = useState<EntityPreviewRequest | null>(null);
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const previewKind = typeof search.previewKind === 'string' && previewKinds.has(search.previewKind as EntityPreviewKind)
    ? search.previewKind as EntityPreviewKind
    : null;
  const previewId = typeof search.previewId === 'string' && search.previewId.trim().length > 0 ? search.previewId : null;

  useEffect(() => subscribeEntityPreview(setRequest), []);
  useEffect(() => {
    if (previewKind && previewId) setRequest({ kind: previewKind, id: previewId });
  }, [previewId, previewKind]);

  const closePreview = () => {
    setRequest(null);
    if (!previewKind && !previewId) return;
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => {
        const next: Record<string, unknown> = { ...previous };
        delete next.previewKind;
        delete next.previewId;
        return next;
      },
      replace: true,
    });
  };

  return (
    <>
      {request?.kind === 'property' ? (
        <PropertyPreviewDialog propertyId={request.id} open onOpenChange={(open) => { if (!open) closePreview(); }} />
      ) : null}
      {request?.kind === 'unit' ? (
        <UnitPreviewDialog unitId={request.id} open onOpenChange={(open) => { if (!open) closePreview(); }} />
      ) : null}
      {request?.kind === 'contract' ? (
        <ContractPreviewDialog contractId={request.id} open onOpenChange={(open) => { if (!open) closePreview(); }} />
      ) : null}
      {request?.kind === 'owner' ? (
        <OwnerPreviewDialog ownerId={request.id} open onOpenChange={(open) => { if (!open) closePreview(); }} />
      ) : null}
    </>
  );
}
