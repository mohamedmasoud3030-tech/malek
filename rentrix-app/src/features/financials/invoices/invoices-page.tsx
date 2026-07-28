import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { InvoiceWorkspaceSection } from '../components/invoice-workspace-section';

export type InvoicesWorkspaceMode = 'standalone' | 'embedded';

export type InvoicesWorkspaceProps = Readonly<{
  /**
   * standalone: renders the full page shell (PageLayout + PageHeader) — used
   * by the legacy /invoices route when visited directly.
   * embedded: renders only the workspace body — used inside the collections
   * finance hub, which already supplies its own page shell and tab header.
   */
  mode?: InvoicesWorkspaceMode;
}>;

/**
 * Owns the invoices workspace body. Shared verbatim between the standalone
 * /invoices route and the embedded finance hub tab so business logic,
 * queries, and mutations are never duplicated.
 */
export function InvoicesWorkspace({ mode = 'standalone' }: InvoicesWorkspaceProps) {
  if (mode === 'embedded') {
    return <InvoiceWorkspaceSection />;
  }

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader title="الفواتير" description="إدارة الفواتير المستحقة وتسجيل الدفعات من نفس نظام العرض المالي الموحد." />
      <InvoiceWorkspaceSection />
    </PageLayout>
  );
}

export function InvoicesPage() {
  return <InvoicesWorkspace />;
}
