import { describe, expect, it } from 'vitest';
import { FinancialsPage } from './financials-page';
import { InvoicesPage } from './invoices/invoices-page';
import { ReceiptsPage } from './receipts/receipts-page';
import { ExpensesPage } from './expenses/expenses-page';
import { DepositsPage } from './deposits/deposits-page';
import { OwnerSettlementsPage } from '@/features/owners/owner-settlements-page';
import { FinancialsRouteComponent } from '@/routes/_protected.financials';
import { InvoicesRouteComponent } from '@/routes/_protected.invoices';
import { ReceiptsRouteComponent } from '@/routes/_protected.receipts';
import { ExpensesRouteComponent } from '@/routes/_protected.expenses';
import { DepositsRouteComponent } from '@/routes/_protected.deposits';
import { OwnerSettlementsRouteComponent } from '@/routes/_protected.owner-settlements';

describe('financials route wiring (Supabase-backed)', () => {
  it('FinancialsRouteComponent → FinancialsPage', () => {
    expect(FinancialsRouteComponent).toBe(FinancialsPage);
  });
  it('InvoicesRouteComponent → InvoicesPage', () => {
    expect(InvoicesRouteComponent).toBe(InvoicesPage);
  });
  it('ReceiptsRouteComponent → ReceiptsPage', () => {
    expect(ReceiptsRouteComponent).toBe(ReceiptsPage);
  });
  it('ExpensesRouteComponent → ExpensesPage', () => {
    expect(ExpensesRouteComponent).toBe(ExpensesPage);
  });
  it('DepositsRouteComponent → DepositsPage', () => {
    expect(DepositsRouteComponent).toBe(DepositsPage);
  });
  it('OwnerSettlementsRouteComponent → OwnerSettlementsPage', () => {
    expect(OwnerSettlementsRouteComponent).toBe(OwnerSettlementsPage);
  });
});
