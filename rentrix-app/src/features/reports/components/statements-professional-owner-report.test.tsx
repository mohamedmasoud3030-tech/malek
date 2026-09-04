// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StatementsSection } from './StatementsSection';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
import { documentService } from '@/services/documents/DocumentService';
import { getOwnerFinancialAuthority } from '@/features/owners/services/owner-financial-service';
import { listOwnerSettlements } from '@/features/owners/services/owner-settlements-service';
import { listOwnerProperties } from '@/features/owners/services/owner-service';
import { listMaintenance } from '@/features/maintenance/maintenance-service';
import { listUtilityBills } from '@/features/utilities/utilities-service';
import type { OwnerStatementReport } from '@/features/financials/reports/financialReportsService';
import type { DocumentCompanySettings } from '@/services/documents/companyIdentity';

const docSettingsState: { companySettings: DocumentCompanySettings; isReady: boolean } = {
  companySettings: {
    companyName: 'شركة مسار العقارية',
    registrationNumber: '12345678',
    taxNumber: 'OM12345678',
    currency: 'OMR',
    address: 'مسقط',
    documentPrefixes: {},
  },
  isReady: true,
};

vi.mock('@/features/settings/useDocumentSettings', () => ({
  useDocumentSettings: () => docSettingsState,
}));

vi.mock('@/services/documents/DocumentService', () => ({
  documentService: {
    printDocument: vi.fn().mockResolvedValue(undefined),
    downloadDocumentPdf: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/features/reports/accounting-report-authority', () => ({
  useAuthoritativeGlCashFlow: () => ({ data: null, error: null, isLoading: false }),
}));

vi.mock('@/features/owners/services/owner-financial-service', () => ({
  getOwnerFinancialAuthority: vi.fn(),
}));
vi.mock('@/features/owners/services/owner-settlements-service', () => ({
  listOwnerSettlements: vi.fn(),
}));
vi.mock('@/features/owners/services/owner-service', () => ({
  listOwnerProperties: vi.fn(),
}));
vi.mock('@/features/maintenance/maintenance-service', () => ({
  listMaintenance: vi.fn(),
}));
vi.mock('@/features/utilities/utilities-service', () => ({
  listUtilityBills: vi.fn(),
  responsiblePartyLabels: { tenant: 'المستأجر', landlord: 'المالك', company: 'شركة الإدارة' },
}));

const ownerStatement: OwnerStatementReport = {
  ownerName: 'سالم الحارثي',
  commissionType: 'RATE',
  commissionValue: 5,
  transactions: [
    { date: '2026-02-10', details: 'إيجار شقة 101', type: 'payment', propertyName: 'برج الشروق', gross: 1000, deduction: 50, net: 950 },
  ],
  totalGross: 1000,
  totalDeductions: 50,
  totalNet: 950,
  periodFrom: '2026-02-01',
  periodTo: '2026-02-28',
  error: null,
};

const position = {
  owner_id: 'o-01',
  basis: 'settlement-cycle',
  operating_model: 'management-fees',
  period: {
    tenant_collections: 5000,
    management_fees: { amount: 250 },
    owner_expenses: 300,
    fee_vat: 12.5,
    authorized_adjustments: 0,
    net_payable: 4437.5,
  },
  lifecycle_all_time: {
    settled_pending_net: 800,
    paid_net: 3000,
    remaining_payable: 1437.5,
    draft_count: 1,
    approved_count: 2,
    paid_count: 3,
    cancelled_count: 1,
  },
  owner_funds: { held: 0 },
};

function renderOwnerSection(overrides: {
  ownerStatement?: OwnerStatementReport | undefined;
  selectedOwnerId?: string;
  focus?: 'all' | 'owner';
} = {}) {
  const hasStatementOverride = Object.prototype.hasOwnProperty.call(overrides, 'ownerStatement');
  const statementValue = hasStatementOverride ? overrides.ownerStatement : ownerStatement;
  return render(
    <StatementsSection
      financialSummary={undefined}
      vatReturn={undefined}
      tenantStatement={undefined}
      ownerStatement={statementValue}
      selectedContractId=""
      selectedOwnerId={overrides.selectedOwnerId !== undefined ? overrides.selectedOwnerId : 'o-01'}
      tenantStatementError={undefined}
      ownerStatementError={undefined}
      isTenantStatementLoading={false}
      isOwnerStatementLoading={false}
      isLoading={false}
      filters={{ from: '2026-02-01', to: '2026-02-28', propertyId: undefined, ownerId: 'o-01' }}
      focus={overrides.focus}
    />,
  );
}

describe('StatementsSection professional owner report wiring', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    docSettingsState.isReady = true;
    vi.mocked(getOwnerFinancialAuthority).mockResolvedValue({
      position: position as never,
      statement: { total_gross: 5000, total_deductions: 250, total_net: 4750 },
    } as never);
    vi.mocked(listOwnerSettlements).mockResolvedValue([] as never);
    vi.mocked(listOwnerProperties).mockResolvedValue([] as never);
    vi.mocked(listMaintenance).mockResolvedValue([] as never);
    vi.mocked(listUtilityBills).mockResolvedValue([] as never);
    vi.clearAllMocks();
  });

  it('renders the professional owner report actions next to the canonical statement', () => {
    renderOwnerSection();
    expect(screen.getByRole('button', { name: 'تنزيل كشف المالك PDF' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'خيارات إخراج كشف المالك' })).toBeDefined();
  });

  it('prints the professional owner report pack with the canonical statement scope', async () => {
    renderOwnerSection();
    fireEvent.click(screen.getByRole('button', { name: 'خيارات إخراج كشف المالك' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'طباعة' }));

    await vi.waitFor(() => {
      expect(documentService.printDocument).toHaveBeenCalledWith('owner_report', expect.objectContaining({
        settings: docSettingsState.companySettings,
        payload: expect.objectContaining({ ownerName: 'سالم الحارثي', periodFrom: '2026-02-01', periodTo: '2026-02-28' }),
      }));
    });
    expect(getOwnerFinancialAuthority).toHaveBeenCalledWith('o-01', '2026-02-01', '2026-02-28');
  });

  it('downloads the professional owner report pack as PDF', async () => {
    renderOwnerSection();
    fireEvent.click(screen.getByRole('button', { name: 'تنزيل كشف المالك PDF' }));

    await vi.waitFor(() => {
      expect(documentService.downloadDocumentPdf).toHaveBeenCalledWith('owner_report', expect.objectContaining({
        payload: expect.objectContaining({ reportType: 'Owner_Financial_Report_Pack' }),
      }));
    });
  });

  it('refuses generation truthfully when no owner statement is loaded', () => {
    renderOwnerSection({ ownerStatement: undefined });
    // The canonical panel and its actions only render when a statement is loaded —
    // the truthful refusal is to withhold the action entirely.
    expect(screen.queryByRole('button', { name: 'تنزيل كشف المالك PDF' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'خيارات إخراج كشف المالك' })).toBeNull();
  });

  it('shows the canonical readiness notice without restoring the deleted status strip', () => {
    docSettingsState.isReady = false;
    renderOwnerSection();
    expect(screen.getByText('أكمل بيانات الشركة الأساسية في الإعدادات قبل طباعة هذا المستند.')).toBeDefined();
    expect(screen.queryByText('هوية المستند')).toBeNull();
  });

  it('does not duplicate product-owned output actions inside the owner-focused body', () => {
    renderOwnerSection({ focus: 'owner' });
    expect(screen.queryByRole('button', { name: 'تنزيل كشف المالك PDF' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'خيارات إخراج كشف المالك' })).toBeNull();
  });

  it('does NOT show a running balance column in the owner panel (authority unavailable)', () => {
    renderOwnerSection();
    // The "الرصيد الجاري" column header must not appear in the owner panel
    // because there is no authoritative opening balance to compute from.
    expect(screen.queryByText('الرصيد الجاري')).toBeNull();
  });

  it('explains truthfully why the owner running balance is unavailable', () => {
    renderOwnerSection();
    expect(screen.getByText(/الرصيد الجاري لا يُعرض لأن سلطة كشف المالك الحالية لا توفّر رصيد افتتاح معتمدًا/)).toBeDefined();
  });
});