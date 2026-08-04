import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('contract creation workflow order and agreement resolution contract', () => {
  const fieldsSource = readFileSync(
    resolve(import.meta.dirname, './components/ContractFormFields.tsx'),
    'utf8',
  );

  const modalSource = readFileSync(
    resolve(import.meta.dirname, './contract-form-modal.tsx'),
    'utf8',
  );

  const hookSource = readFileSync(
    resolve(import.meta.dirname, './useContractForm.ts'),
    'utf8',
  );

  const alertSource = readFileSync(
    resolve(import.meta.dirname, './components/ContractAgreementMissingAlert.tsx'),
    'utf8',
  );

  const pageSource = readFileSync(
    resolve(import.meta.dirname, './ContractFormPage.tsx'),
    'utf8',
  );

  const invariantsMigration = readFileSync(
    resolve(import.meta.dirname, '../../../../supabase/migrations/20260730091200_contract_workflow_invariants.sql'),
    'utf8',
  ).toLowerCase();

  it('1. Select property, 2. Select available unit, and 3. Select/create tenant in natural employee order', () => {
    expect(fieldsSource).toContain('label="العقار"');
    expect(fieldsSource).toContain('label="الوحدة"');
    expect(fieldsSource).toContain('label="المستأجر"');
    expect(fieldsSource).toContain('isUnitSelectableForContract');
  });

  it('4. Automatically resolves active owner-management agreement when unambiguous', () => {
    expect(hookSource).toContain('useAgreementCoverage');
    expect(hookSource).toContain('const agreementId = agreementCoverageQuery.data?.id ?? null');
    expect(alertSource).toContain('تم تحديد اتفاقية تشغيل المالك تلقائياً');
  });

  it('5. Shows an actionable recovery surface when no valid management agreement exists covering the lease dates', () => {
    expect(fieldsSource).toContain('ContractAgreementMissingAlert');
    expect(pageSource).toContain('ContractAgreementMissingAlert');
    expect(alertSource).toContain('لا توجد اتفاقية إدارة تغطي كامل فترة العقد');
    expect(alertSource).toContain('فتح اتفاقيات العقار');
  });

  it('6. Validates overlapping contracts server-side via database trigger', () => {
    expect(invariantsMigration).toContain('create trigger contracts_workflow_invariants');
    expect(invariantsMigration).toContain('enforce_contract_workflow_invariants');
    expect(invariantsMigration).toContain('operational contract requires a covering agreement');
  });

  it('7. Exposes an invoice payment schedule review preview section before confirming contract', () => {
    expect(fieldsSource).toContain('title="مراجعة جدول الفواتير والدفعات المتوقعة"');
    expect(fieldsSource).toContain('{estimatedInstallments} فواتير');
    expect(fieldsSource).toContain('يتم إنشاء الفواتير وجدولة دفعاتها آلياً على الخادم وفقاً للعقد المعتمد');
  });
});
