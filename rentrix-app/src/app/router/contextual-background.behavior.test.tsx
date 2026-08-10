// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/dashboard/dashboard-page', () => ({ DashboardPage: () => <div data-testid="dashboard-workspace">Dashboard workspace</div> }));
vi.mock('@/features/reports/reports-page', () => ({ ReportsPage: () => <div data-testid="reports-workspace">Reports workspace</div> }));
vi.mock('@/features/people/people-list-page', () => ({ PeopleListPage: () => <div data-testid="people-workspace">People workspace</div> }));
vi.mock('@/features/portfolio-hub/portfolio-hub-workspace', () => ({ PortfolioHubPage: () => <div data-testid="properties-workspace">Properties workspace</div> }));
vi.mock('@/features/tenants/TenantsPage', () => ({ TenantsWorkspace: () => <div data-testid="tenants-workspace">Tenants workspace</div> }));
vi.mock('@/features/contracts/ContractsListPage', () => ({ ContractsListPage: () => <div data-testid="contracts-workspace">Contracts workspace</div> }));

import { ContextualBackground } from './contextual-background';

describe('contextual dialog backgrounds', () => {
  it('renders the actual Reports workspace behind a tenant → contract dialog chain', () => {
    const { rerender } = render(<ContextualBackground location={{ pathname: '/reports' }} fallback={<div data-testid="fallback" />} />);
    expect(screen.getByTestId('reports-workspace')).toBeTruthy();
    expect(screen.queryByTestId('tenants-workspace')).toBeNull();
    // Nested contract navigation retains the same original background.
    rerender(<ContextualBackground location={{ pathname: '/reports' }} fallback={<div data-testid="fallback" />} />);
    expect(screen.getByTestId('reports-workspace')).toBeTruthy();
  });

  it('keeps Dashboard and People/Property origins instead of substituting canonical lists', () => {
    const { rerender } = render(<ContextualBackground location={{ pathname: '/dashboard' }} fallback={<div />} />);
    expect(screen.getByTestId('dashboard-workspace')).toBeTruthy();
    rerender(<ContextualBackground location={{ pathname: '/people' }} fallback={<div />} />);
    expect(screen.getByTestId('people-workspace')).toBeTruthy();
    rerender(<ContextualBackground location={{ pathname: '/properties' }} fallback={<div />} />);
    expect(screen.getByTestId('properties-workspace')).toBeTruthy();
  });
});
