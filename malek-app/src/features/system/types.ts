type IntegritySeverity = 'ok' | 'warning' | 'critical';

export type DataIntegrityCheck = Readonly<{
  id: string;
  label: string;
  description: string;
  severity: IntegritySeverity;
  count: number;
}>;

type DataIntegritySnapshot = Readonly<{
  checkedAt: string;
  checks: readonly DataIntegrityCheck[];
}>;

export type DataIntegrityResult =
  | Readonly<{ status: 'available'; snapshot: DataIntegritySnapshot }>
  | Readonly<{ status: 'unavailable'; reason: string }>;

