import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync('../supabase/migrations/20260713000100_owner_agreement_temporal_controls.sql', 'utf8');

describe('owner agreement temporal controls migration', () => {
  it('protects against overlapping owner agreement periods at database level', () => {
    expect(migrationSql).toContain('owner_agreements_no_overlap');
    expect(migrationSql).toContain('daterange(starts_on, COALESCE(ends_on');
  });

  it('protects shared ownership percentages and primary-owner periods by date range', () => {
    expect(migrationSql).toContain('assert_property_owner_temporal_integrity');
    expect(migrationSql).toContain('pg_advisory_xact_lock');
    expect(migrationSql).toContain('candidate_dates');
    expect(migrationSql).toContain('NEW.ownership_percentage + COALESCE');
    expect(migrationSql).toContain('لا يمكن وجود أكثر من مالك أساسي');
  });

  it('validates ownership inputs before evaluating temporal totals', () => {
    expect(migrationSql).toContain('NEW.ownership_percentage <= 0');
    expect(migrationSql).toContain('NEW.ends_on < NEW.starts_on');
    expect(migrationSql).toContain('نسبة الملكية يجب أن تكون أكبر من صفر');
  });

  it('blocks agreement edits that would leave existing contracts outside the new period', () => {
    expect(migrationSql).toContain('assert_owner_agreement_covers_linked_contracts');
    expect(migrationSql).toContain('c.agreement_id = NEW.id');
    expect(migrationSql).toContain('c.end_date::date > NEW.ends_on');
    expect(migrationSql).toContain('لا يمكن تعديل اتفاقية المالك');
  });

  it('allows renewal to explicitly use a covering future agreement', () => {
    expect(migrationSql).toContain("v_requested_agreement_id uuid := NULLIF(new_contract_data ->> 'agreement_id', '')::uuid");
    expect(migrationSql).toContain('COALESCE(v_requested_agreement_id, v_old.agreement_id)');
    expect(migrationSql).toContain('لا توجد اتفاقية مكتب ومالك تغطي كامل فترة التجديد');
  });
});