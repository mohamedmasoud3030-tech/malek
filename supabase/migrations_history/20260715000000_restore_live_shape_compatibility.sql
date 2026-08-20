-- Restore columns present in the supported live/consolidated schema before
-- later guarded cleanup migrations replay against the code-first baseline.
--
-- Production environments that already contain these columns are unchanged.
-- Clean replays receive the same column names and identifier relationships used
-- by current application code and the consolidated schema.

ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS owner_id uuid
    REFERENCES public.owners(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS no text;
