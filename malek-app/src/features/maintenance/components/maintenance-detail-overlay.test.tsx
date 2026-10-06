// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServiceProviderCategory, ServiceProviderOption } from '@/features/service-providers/service-provider-service';
import { deriveMaintenanceAttention, type MaintenanceAttention } from '../maintenance-attention';
import type { Maintenance } from '../maintenance-service';
import { getPrimaryMaintenanceAction, type MaintenanceAction } from '../useMaintenancePageController';
import { MaintenanceDetailsOverlay } from './maintenance-detail-resolve-overlays';

vi.mock('@/components/documents/contextual-documents-section', () => ({
  ContextualDocumentsSection: () => <div data-contextual-documents />,
}));

const TODAY = '2026-08-27';

// The preview dialog renders into a portal, so unmount explicitly between
// cases — this suite does not enable testing-library's global auto-cleanup.
afterEach(() => {
  cleanup();
});

const providerOptions: ServiceProviderOption[] = [
  { id: 'provider-1', name: 'شركة النور للمقاولات', phone: null, categoryIds: ['category-1'] },
];
const providerCategories: ServiceProviderCategory[] = [];

function request(overrides: Partial<Maintenance> = {}): Maintenance {
  return {
    id: 'request-1',
    company_id: 'company-1',
    property_id: 'property-1',
    unit_id: null,
    title: 'تسرب مياه في المطبخ',
    description: 'تسرب مستمر أسفل الحوض.',
    priority: 'high',
    status: 'open',
    request_date: '2026-08-10',
    scheduled_date: null,
    created_at: '2026-08-10T00:00:00.000Z',
    service_provider_id: 'provider-1',
    service_provider_category_id: 'category-1',
    assigned_to: 'سالم البلوشي',
    technician_name: null,
    cost: null,
    attachment_url: null,
    ...overrides,
  } as Maintenance;
}

type OverlayProps = Readonly<{
  request?: Maintenance | null;
  attention?: MaintenanceAttention | null;
  nextAction?: MaintenanceAction | null;
  nextActionDisabled?: boolean;
  onRunNextAction?: (action: MaintenanceAction) => void;
}>;

function renderOverlay(props: OverlayProps = {}) {
  return render(
    <MaintenanceDetailsOverlay
      request={props.request === undefined ? request() : props.request}
      providerOptions={providerOptions}
      providerCategories={providerCategories}
      onOpenChange={() => undefined}
      attention={props.attention}
      nextAction={props.nextAction}
      nextActionDisabled={props.nextActionDisabled}
      onRunNextAction={props.onRunNextAction}
    />,
  );
}

describe('MaintenanceDetailsOverlay operational summary', () => {
  it('presents the canonical attention state instead of a flat field list', () => {
    // 17 days old and still in progress: stalled by the canonical window.
    const row = request({ status: 'in_progress', request_date: '2026-08-10' });
    const attention = deriveMaintenanceAttention(row, TODAY);
    expect(attention.isStalled).toBe(true);

    renderOverlay({ request: row, attention });

    const panel = screen.getByLabelText('المتابعة التشغيلية للطلب');
    expect(panel.textContent).toContain('متوقفة عن التقدم');
    const age = panel.querySelector('[data-maintenance-detail-age]');
    expect(age?.textContent).toBe('منذ 17 يوم');
  });

  it('shows every canonical flag for a request that missed its visit and awaits closure', () => {
    const row = request({ status: 'resolved', request_date: '2026-08-01', scheduled_date: '2026-08-05' });
    const attention = deriveMaintenanceAttention(row, TODAY);
    expect(attention.flags).toContain('awaiting_closure');

    renderOverlay({ request: row, attention });

    const panel = screen.getByLabelText('المتابعة التشغيلية للطلب');
    expect(panel.textContent).toContain('بانتظار الإغلاق');
    expect(panel.textContent).not.toContain('متوقفة عن التقدم');
  });

  it('says plainly when nothing needs attention instead of leaving the panel empty', () => {
    const row = request({ status: 'closed', request_date: TODAY });
    const attention = deriveMaintenanceAttention(row, TODAY);
    expect(attention.flags).toHaveLength(0);

    renderOverlay({ request: row, attention });

    expect(screen.getByText('لا توجد متابعة مطلوبة على هذا الطلب.')).toBeTruthy();
  });

  it('consolidates provider and technician into one ownership answer', () => {
    renderOverlay({ request: request() });

    expect(screen.getByText('الجهة المنفذة')).toBeTruthy();
    expect(screen.getByText('شركة النور للمقاولات')).toBeTruthy();
    expect(screen.getByText('الفني المسؤول: سالم البلوشي')).toBeTruthy();
    // The two old half-answers are gone.
    expect(screen.queryByText('الفني / المسؤول')).toBeNull();
  });

  it('falls back to the technician name when no assignee is recorded', () => {
    renderOverlay({ request: request({ assigned_to: null, technician_name: 'خالد السعيدي' }) });

    expect(screen.getByText('الفني المسؤول: خالد السعيدي')).toBeTruthy();
  });

  it('offers the canonical next action and routes it through the supplied handler', async () => {
    const user = userEvent.setup();
    const row = request({ status: 'in_progress' });
    const nextAction = getPrimaryMaintenanceAction('in_progress', () => true);
    expect(nextAction?.status).toBe('resolved');
    const onRunNextAction = vi.fn();

    renderOverlay({ request: row, attention: deriveMaintenanceAttention(row, TODAY), nextAction, onRunNextAction });

    const button = screen.getByRole('button', { name: /تم التنفيذ/ });
    expect(button.getAttribute('data-maintenance-detail-next-action')).toBe('resolved');

    await user.click(button);
    expect(onRunNextAction).toHaveBeenCalledWith(nextAction);
  });

  it('never offers an action for terminal states', () => {
    // The canonical matrix yields no actions for closed/cancelled, so the
    // projected next action is null and no affordance may render.
    expect(getPrimaryMaintenanceAction('closed', () => true)).toBeNull();
    expect(getPrimaryMaintenanceAction('cancelled', () => true)).toBeNull();

    const row = request({ status: 'closed' });
    renderOverlay({ request: row, attention: deriveMaintenanceAttention(row, TODAY), nextAction: null });

    expect(screen.queryByText('الإجراء التالي')).toBeNull();
    expect(screen.queryByRole('button', { name: /تم التنفيذ/ })).toBeNull();
  });

  it('respects the disabled state while another action is in flight', () => {
    const row = request({ status: 'open' });
    const nextAction = getPrimaryMaintenanceAction('open', () => true);

    renderOverlay({
      request: row,
      attention: deriveMaintenanceAttention(row, TODAY),
      nextAction,
      nextActionDisabled: true,
      onRunNextAction: vi.fn(),
    });

    expect((screen.getByRole('button', { name: /بدء التنفيذ/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
