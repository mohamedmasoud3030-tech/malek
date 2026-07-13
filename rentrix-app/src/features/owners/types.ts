import type { OwnerDetailSnapshot, OwnerHubSnapshot } from './services/owner-service';

export type OwnersHubState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error'; error: unknown }>
  | Readonly<{ status: 'unavailable'; reason: string }>
  | Readonly<{ status: 'ready'; snapshot: OwnerHubSnapshot }>;

export type OwnerDetailState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error'; error: unknown }>
  | Readonly<{ status: 'unavailable'; reason: string }>
  | Readonly<{ status: 'ready'; snapshot: OwnerDetailSnapshot }>;
