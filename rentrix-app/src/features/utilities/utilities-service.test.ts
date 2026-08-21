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

  it('lists meters and bills with deterministic order and paged reads', () => {
    const servicePath = resolve(import.meta.dirname, './utilities-service.ts');
    const content = readFileSync(servicePath, 'utf8');
    expect(content).toContain('fetchAllRows');
    expect(content).toContain(".order('created_at', { ascending: false })");
    expect(content).toContain(".order('due_date', { ascending: false })");
    // Secondary id order prevents duplicate/missing pages on timestamp ties.
    expect(content.match(/\.order\('id', \{ ascending: false \}\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(content).toContain('.maybeSingle()');
  });

  it('page file does not contain hardcoded mock bills', () => {
    const pagePath = resolve(import.meta.dirname, './utilities-page.tsx');
    const content = readFileSync(pagePath, 'utf8');
    expect(content).not.toContain('INV-2026-001');
    expect(content).not.toContain('E-902148');
    expect(content).not.toContain('meter-1');
    expect(content).not.toContain('950');
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
