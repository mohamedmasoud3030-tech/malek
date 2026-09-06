import type { OwnerDetailSnapshot } from './services/owner-service';

export type OwnerDetailState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error'; error: unknown }>
  | Readonly<{ status: 'unavailable'; reason: string }>
  | Readonly<{ status: 'ready'; snapshot: OwnerDetailSnapshot }>;
