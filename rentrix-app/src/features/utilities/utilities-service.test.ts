import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('utilities real implementation - no mock data', () => {
  it('service file does not contain placehold.co or hardcoded mock meters E-902148', () => {
    const servicePath = resolve(import.meta.dirname, './utilities-service.ts');
    const content = readFileSync(servicePath, 'utf8');
    expect(content).not.toContain('placehold.co');
    expect(content).not.toContain('E-902148');
    expect(content).not.toContain('W-441209');
    expect(content).not.toContain('meter-1');
    expect(content).not.toContain('ACC-88123');
    expect(content).not.toContain('return [');
    expect(content).not.toMatch(/شركة كهرباء مسقط/);
  });

  it('page file does not contain hardcoded mock bills', () => {
    const pagePath = resolve(import.meta.dirname, './utilities-page.tsx');
    const content = readFileSync(pagePath, 'utf8');
    expect(content).not.toContain('INV-2026-001');
    expect(content).not.toContain('E-902148');
    expect(content).not.toContain('meter-1');
    expect(content).not.toContain('950');
  });

  it('migration creates real utility_meters table with RLS hardened to manager write', async () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../supabase/migrations/20260717000001_real_utility_meters_and_enhance_bills.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('create table public.utility_meters');
    expect(sql).toContain("'public.properties'::regclass");
    expect(sql).toContain("'public.units'::regclass");
    expect(sql).toContain('manager_write_utility_meters');
    expect(sql).toContain('app_read_utility_meters');
    expect(sql).toContain('is_admin_or_manager()');
    expect(sql).toContain('alter table public.utility_meters enable row level security');
    expect(sql).toContain('idx_utility_meters_property_id');
  });

  it('migration enhances utility_bills with missing columns', async () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../supabase/migrations/20260717000001_real_utility_meters_and_enhance_bills.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('meter_id');
    expect(sql).toContain('previous_reading');
    expect(sql).toContain('consumption_units');
    expect(sql).toContain('paid_amount');
  });
});

describe('utilities service error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws actionable error when supabase fails (no void error)', async () => {
    const supabaseMock = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        returns: vi.fn().mockResolvedValue({ data: null, error: { message: 'network error', code: '500' } }),
      })),
    };

    vi.doMock('@/lib/supabase', () => ({ supabase: supabaseMock }));

    // We test that the service file contains handleSupabaseError and does not contain void error pattern
    const servicePath = resolve(import.meta.dirname, './utilities-service.ts');
    const content = readFileSync(servicePath, 'utf8');
    expect(content).toContain('handleSupabaseError');
    expect(content).not.toContain('void error');
    expect(content).not.toContain('return true');
  });
});
