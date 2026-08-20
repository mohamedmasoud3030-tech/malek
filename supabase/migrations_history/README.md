# Historical migration chain

These files are the pre-canonical MALEK migration history. They are retained as
searchable forensic evidence and MUST NOT be replayed for a fresh database.

The active bootstrap moved to `supabase/migrations/20260901000000_canonical_baseline.sql`
after a real-Supabase replay, evidence-based canonicalization, two fresh rebuilds
and schema-diff verification.

Future schema changes belong only in `supabase/migrations/` as new forward
migrations after the canonical baseline.
