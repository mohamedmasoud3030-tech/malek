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

  const formPageSource = readFileSync(
    resolve(import.meta.dirname, './ContractFormPage.tsx'),
    'utf8',
  );

  const detailPageSource = readFileSync(
    resolve(import.meta.dirname, './pages/ContractDetailPage.tsx'),
    'utf8',
  );

  const unitDetailSource = readFileSync(
    resolve(import.meta.dirname, '../properties/units/property-unit-detail-page.tsx'),
    'utf8',
  );

  const unitsListSource = readFileSync(
    resolve(import.meta.dirname, '../units/units-list.tsx'),
    'utf8',
  );

  const personModalSource = readFileSync(
    resolve(import.meta.dirname, '../people/person-form-modal.tsx'),
    'utf8',
  );

  const alertSource = readFileSync(
    resolve(import.meta.dirname, './components/ContractAgreementMissingAlert.tsx'),
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
    expect(modalSource).toContain('إضافة مستأجر');
    expect(modalSource).toContain('defaultType="tenant"');
  });

  it('starts the leasing task from an available unit without asking the user to reselect the asset', () => {
    expect(unitDetailSource).toContain("unit.status === 'available'");
    expect(unitDetailSource).toContain('to="/contracts/new"');
    expect(unitDetailSource).toContain('search={{ propertyId, unitId: unit.id }}');
    expect(unitsListSource).toContain('unit.status === "available"');
    expect(unitsListSource).toContain('search: { propertyId, unitId: unit.id }');
    expect(formPageSource).toContain("typeof search.propertyId === 'string'");
    expect(formPageSource).toContain("typeof search.unitId === 'string'");
    expect(modalSource).toContain('initialPropertyId={initialPropertyId}');
    expect(modalSource).toContain('initialUnitId={initialUnitId}');
    expect(hookSource).toContain("property_id: isEdit ? '' : initialPropertyId");
    expect(hookSource).toContain("unit_id: isEdit ? '' : initialUnitId");
    expect(hookSource).toContain('getContractUnitDefaultRent');
  });

  it('creates a missing tenant inside the contract task and selects the created record automatically', () => {
    expect(modalSource).toContain('PersonFormModal');
    expect(modalSource).toContain("form.setValue('tenant_id', person.id");
    expect(personModalSource).toContain('onCreated?: (person: Person) => void');
    expect(personModalSource).toContain('onCreated?.(person)');
  });

  it('lands a newly saved draft on its detail lifecycle instead of dropping the user back on the list', () => {
    expect(formPageSource).toContain('onCreated={(contract) =>');
    expect(formPageSource).toContain("to: '/contracts/$contractId'");
    expect(formPageSource).toContain('contractId: contract.id');
    expect(detailPageSource).toContain('<ContractApprovalSection contract={contract} />');
  });

  it('4. Automatically resolves active owner-management agreement when unambiguous', () => {
    expect(hookSource).toContain('useAgreementCoverage');
    expect(hookSource).toContain('const agreementId = agreementCoverageQuery.data?.id ?? null');
    expect(alertSource).toContain('تم تحديد اتفاقية تشغيل المالك تلقائياً');
  });

  it('5. Shows an actionable recovery surface when no valid management agreement exists covering the lease dates', () => {
    expect(fieldsSource).toContain('ContractAgreementMissingAlert');
    // The alert is rendered by the modal (the live create/edit surface); the
    // retired full-page shell was removed in Wave A.
    expect(modalSource).toContain('ContractAgreementMissingAlert');
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