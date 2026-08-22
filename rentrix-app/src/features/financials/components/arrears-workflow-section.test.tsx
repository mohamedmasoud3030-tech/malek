import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { OverdueInvoicesReport } from '../reports/financialReportsService';
import { ArrearsSummaryCards } from './arrears-summary-cards';
import { ArrearsWorkflowSection } from './arrears-workflow-section';

const baseProps = {
  asOf: '2026-05-15',
  search: '',
  bucketFilter: 'all' as const,
  overdueReport: undefined,
  agedReceivablesReport: undefined,
  arrearsSummaryReport: undefined,
  selectedInvoiceId: '',
  isLoading: false,
  isError: false,
  error: undefined,
  onAsOfChange: vi.fn(),
  onSearchChange: vi.fn(),
  onBucketFilterChange: vi.fn(),
  onSelectInvoice: vi.fn(),
};

const overdueReport: OverdueInvoicesReport = {
  asOf: '2026-05-15',
  totalOverdue: 800,
  invoiceCount: 1,
  rows: [
    {
      invoiceId: 'invoice_alpha_123456',
      shortInvoiceId: 'invoice_',
      contractId: 'contract_alpha_123456',
      tenantId: 'tenant_alpha',
      tenantName: 'أحمد علي',
      propertyId: 'property_alpha',
      propertyTitle: 'برج النخيل',
      unitId: 'unit_alpha',
      unitNumber: 'A-101',
      dueDate: '2026-04-01',
      daysOverdue: 44,
      amount: 1000,
      paidAmount: 200,
      remainingAmount: 800,
      status: 'partial',
    },
  ],
};

type ElementProps = Readonly<{
  children?: ReactNode;
  onClick?: () => void;
}>;

function getElementProps(node: ReactNode): ElementProps {
  return React.isValidElement(node) ? node.props as ElementProps : {};
}

function getNodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join('');
  if (!React.isValidElement(node)) return '';
  return getNodeText(getElementProps(node).children);
}

function resolveFunctionComponent(node: ReactNode): ReactNode {
  if (!React.isValidElement(node) || typeof node.type !== 'function') return node;
  const Component = node.type as (props: ElementProps) => ReactNode;
  return Component(node.props as ElementProps);
}

function findButtonByText(node: ReactNode, text: string): React.ReactElement<ElementProps> | undefined {
  const resolvedNode = resolveFunctionComponent(node);
  if (!React.isValidElement(resolvedNode)) return undefined;

  if (resolvedNode.type === 'button' && getNodeText(resolvedNode).includes(text)) {
    return resolvedNode as React.ReactElement<ElementProps>;
  }

  const children = getElementProps(resolvedNode).children;
  const childNodes = Array.isArray(children) ? children : [children];
  for (const child of childNodes) {
    const result = findButtonByText(child, text);
    if (result) return result;
  }

  return undefined;
}

describe('ArrearsWorkflowSection', () => {
  it('renders the loading state', () => {
    const html = renderToStaticMarkup(<ArrearsWorkflowSection {...baseProps} isLoading />);

    // Shared LoadingState contract (section variant): role=status + aria-label + data-loading-state
    // No visible text label for 'section' (skeletons only); label lives in aria-label.
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="جارٍ تحميل بيانات المتأخرات"');
    expect(html).toContain('data-loading-state');
  });

  it('renders the error state', () => {
    const html = renderToStaticMarkup(<ArrearsWorkflowSection {...baseProps} isError error={new Error('تعذر تحميل الاختبار')} />);

    expect(html).toContain('تعذر تحميل الاختبار');
  });

  it('selects the current invoice from the read-only invoice-section button', () => {
    const onSelectInvoice = vi.fn();
    const section = (
      <ArrearsWorkflowSection
        {...baseProps}
        overdueReport={overdueReport}
        selectedInvoiceId="invoice_alpha_123456"
        onSelectInvoice={onSelectInvoice}
      />
    );

    const button = findButtonByText(section, 'عرض الفاتورة في قسم الفواتير');
    expect(button).toBeDefined();

    button?.props.onClick?.();

    expect(onSelectInvoice).toHaveBeenCalledWith('invoice_alpha_123456');
  });

  it('renders summary cards when aged receivables buckets are missing from report data', () => {
    const reportWithoutBuckets = { totalOutstanding: 50 } as Parameters<typeof ArrearsSummaryCards>[0]['agedReceivablesReport'];
    const html = renderToStaticMarkup(
      <ArrearsSummaryCards overdueReport={undefined} agedReceivablesReport={reportWithoutBuckets} arrearsSummaryReport={undefined} />,
    );

    // Register metric strip (#1545): the outstanding card stays visible with
    // the total; bucket-dependent cards hide when their data is missing.
    expect(html).toContain('ملخص المتأخرات');
    expect(html).toContain('المتبقي');
    expect(html).toContain('50.000');
  });
});
