import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const coreSchemaSql = readFileSync(
  join(process.cwd(), '..', 'supabase', 'migrations', '20250101000001_core_schema.sql'),
  'utf8',
);
const costCentersSql = readFileSync(
  join(process.cwd(), '..', 'supabase', 'migrations', '20260628000100_add_cost_centers.sql'),
  'utf8',
);

describe('cost centers migration identifier contract', () => {
  it('keeps the clean repository baseline on UUID identifiers', () => {
    expect(coreSchemaSql).toContain('create table public.properties (');
    expect(coreSchemaSql).toContain('id uuid primary key default gen_random_uuid()');
    expect(coreSchemaSql).toContain('create table public.expenses (');
    expect(coreSchemaSql).toContain('create table public.journal_entries (');
  });

  it('derives the identifier type instead of hard-coding one schema snapshot', () => {
    expect(costCentersSql).toContain("v_property_id_type NOT IN ('uuid', 'text')");
    expect(costCentersSql).toContain("IF v_property_id_type = 'uuid'");
    expect(costCentersSql).toContain('id uuid PRIMARY KEY DEFAULT gen_random_uuid()');
    expect(costCentersSql).toContain('id text PRIMARY KEY DEFAULT (gen_random_uuid())::text');
    expect(costCentersSql).toContain('v_cost_center_id_type <> v_property_id_type');
  });

  it('links dependent columns using the resolved cost center identifier type', () => {
    expect(costCentersSql).toContain(
      "'ALTER TABLE public.expenses ADD COLUMN cost_center_id %s REFERENCES public.cost_centers(id)'",
    );
    expect(costCentersSql).toContain(
      "'ALTER TABLE public.journal_entries ADD COLUMN cost_center_id %s REFERENCES public.cost_centers(id)'",
    );
    expect(costCentersSql).toContain('v_existing_column_type <> v_cost_center_id_type');
  });

  it('fails closed when required tables or compatible identifier types are unavailable', () => {
    expect(costCentersSql).toContain(
      "RAISE EXCEPTION 'Cannot create cost centers: public.properties(id) was not found'",
    );
    expect(costCentersSql).toContain('Cannot create cost centers: unsupported public.properties(id) type %');
    expect(costCentersSql).toContain('Cannot link expenses: expenses.cost_center_id type % differs');
    expect(costCentersSql).toContain('Cannot link journal entries: journal_entries.cost_center_id type % differs');
  });
});
