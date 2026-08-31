import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { InvoiceWorkspaceSection } from '../components/invoice-workspace-section';

export type InvoicesWorkspaceProps = Readonly<{
  /**
   * embedded: rendered inside the finance hub, which already supplies the page
   * shell — the workspace body renders without a second layout or header.
   * standalone (default): reached via /invoices, so it owns the page shell.
   */
  embedded?: boolean;
}>;

/**
 * Owns the invoices workspace body. Shared verbatim between the standalone
 * /invoices route and the embedded finance hub tab so business logic,
 * queries, and mutations are never duplicated.
 */
export function InvoicesWorkspace({ embedded = false }: InvoicesWorkspaceProps) {
  return (
    <EmbeddableWorkspace
      visualVariant="malek-pro"
      embedded={embedded}
      title="الفواتير"
      viewModeStorageKey="malek:invoices:register-view-mode-v1"
    >
      <InvoiceWorkspaceSection />
    </EmbeddableWorkspace>
  );
}

export function InvoicesPage() {
  return <InvoicesWorkspace />;
}
