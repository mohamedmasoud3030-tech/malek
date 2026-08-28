import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(import.meta.dirname, '../../../supabase/migrations/20260901000049_extend_short_stay_atomic.sql'),
  'utf8',
);
const service = readFileSync(resolve(import.meta.dirname, './services/shortStayLifecycleService.ts'), 'utf8');
const detailPage = readFileSync(resolve(import.meta.dirname, './pages/ContractDetailPage.tsx'), 'utf8');
const form = readFileSync(resolve(import.meta.dirname, './lifecycle/ContractShortStayExtensionDialog.tsx'), 'utf8');

describe('short stay extension', () => {
  it('is a dedicated pre-checkout command with overlap and owner-agreement guards', () => {
    expect(migration).toContain("coalesce(lower(v_contract.lease_mode), 'long_term') <> 'short_stay'");
    expect(migration).toContain('current_date >= v_old_end');
    expect(migration).toContain('p_new_end_date <= v_old_end');
    expect(migration).toContain('SHORT_STAY_EXTENSION_OVERLAPS_ANOTHER_CONTRACT');
    expect(migration).toContain('agreement_record.ends_on >= p_new_end_date');
  });

  it('requires both contract edit and invoice-generation capabilities', () => {
    expect(migration).toContain("current_user_has_effective_app_permission('contracts.write')");
    expect(migration).toContain("current_user_has_effective_app_permission('financial.invoices.generate')");
    expect(detailPage).toContain("canAccess('contracts.write')");
    expect(detailPage).toContain("canAccess('financial.invoices.generate')");
  });

  it('preserves the original invoice and posts a supplemental RENT obligation', () => {
    expect(migration).toContain("'RENT'");
    expect(migration).toContain('v_old_end');
    expect(migration).toContain('p_new_end_date');
    expect(migration).toContain('p_extension_amount');
    expect(migration).toContain('public.resolve_active_tax_profile');
    expect(migration).toContain('public.post_journal_event');
    expect(migration).toContain('public.owner_funds_events');
    expect(migration).toContain("document_status = 'POSTED'");
    expect(migration).not.toMatch(/update\s+public\.invoices\s+set\s+amount\s*=/i);
  });

  it('is idempotent and does not trust browser financial scope', () => {
    expect(migration).toContain('financial_operation_idempotency');
    expect(migration).toContain('IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST');
    expect(service).toContain('crypto.randomUUID()');
    expect(service).not.toMatch(/p_(company|owner|tax|account|status)/);
  });

  it('keeps the user interaction to two commercial inputs', () => {
    expect(form).toContain('تاريخ الخروج الجديد');
    expect(form).toContain('مبلغ التمديد المتفق عليه');
    expect(form).not.toMatch(/check.?in|check.?out/i);
  });
});
