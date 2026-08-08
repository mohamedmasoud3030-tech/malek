import { useEffect, useState } from 'react';
import { PropertyPreviewDialog } from '@/features/properties/components/PropertyPreviewDialog';
import { subscribeEntityPreview, type EntityPreviewRequest } from './entity-preview-events';

export function EntityPreviewHost() {
  const [request, setRequest] = useState<EntityPreviewRequest | null>(null);

  useEffect(() => subscribeEntityPreview(setRequest), []);

  return (
    <>
      {request?.kind === 'property' ? (
        <PropertyPreviewDialog
          propertyId={request.id}
          open
          onOpenChange={(open) => { if (!open) setRequest(null); }}
        />
      ) : null}
    </>
  );
}
