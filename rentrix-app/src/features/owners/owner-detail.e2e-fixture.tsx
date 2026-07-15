import { OwnerDetailView } from './components/owner-detail-view';
import type { OwnerDetailState } from './types';

const state = {
  status: 'ready',
  snapshot: {
    owner: {
      id: 'owner-1', full_name: 'خالد السالمي', display_name: 'أبو راشد', phone: '+96899112233', email: 'khalid@example.com', is_active: true,
    },
    properties: [{
      id: 'property-1', title: 'مجمع الخوير التجاري', address: 'الخوير، مسقط', status: 'active',
      property_owners: [{ owner_id: 'owner-1', ends_on: null, ownership_percentage: 75 }],
    }],
    units: [
      { id: 'unit-1', property_id: 'property-1', unit_number: 'A-101', floor: '1', status: 'occupied', rent_amount: 450 },
      { id: 'unit-2', property_id: 'property-1', unit_number: 'A-102', floor: '1', status: 'vacant', rent_amount: 420 },
    ],
    contracts: [{ id: 'contract-1', property_id: 'property-1', unit_id: 'unit-1', start_date: '2026-01-01', end_date: '2026-12-31', status: 'active' }],
    invoices: [],
    financialSummary: { outstandingBalance: 1_250, outstandingInvoicesCount: 2 },
  },
} as unknown as OwnerDetailState;

export function OwnerDetailE2EFixture() {
  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground" dir="rtl" data-e2e-owner-detail-workspace>
      <OwnerDetailView state={state} />
    </main>
  );
}
