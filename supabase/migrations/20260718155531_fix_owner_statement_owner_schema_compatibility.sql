-- Keep the clean replay owner lifecycle contract aligned with the supported
-- production schema. Owner reports and services exclude soft-deleted owners,
-- while historical clean baselines created public.owners without this column.
-- Production already has the column, so this migration is a no-op there.

ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.owners.deleted_at IS
  'Soft-delete timestamp used by owner reads, reports, and lifecycle checks.';
