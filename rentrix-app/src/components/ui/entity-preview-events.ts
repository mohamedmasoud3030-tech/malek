export type EntityPreviewKind = 'property' | 'unit';

export type EntityPreviewRequest = Readonly<{
  kind: EntityPreviewKind;
  id: string;
}>;

const PREVIEW_EVENT = 'malek:entity-preview';

export function openEntityPreview(request: EntityPreviewRequest) {
  globalThis.dispatchEvent(new CustomEvent<EntityPreviewRequest>(PREVIEW_EVENT, { detail: request }));
}

export function subscribeEntityPreview(listener: (request: EntityPreviewRequest) => void) {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<EntityPreviewRequest>).detail;
    if (detail?.id && detail.kind) listener(detail);
  };
  globalThis.addEventListener(PREVIEW_EVENT, handler);
  return () => globalThis.removeEventListener(PREVIEW_EVENT, handler);
}
