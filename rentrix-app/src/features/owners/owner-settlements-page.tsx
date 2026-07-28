import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { OwnerSettlementWorkspace } from './components/OwnerSettlementWorkspace';

export type OwnerSettlementsWorkspaceProps = Readonly<{
  /**
   * embedded: rendered inside the finance hub, which already supplies the page
   * shell — the workspace body renders without a second layout or header.
   * standalone (default): reached via /owner-settlements, so it owns the shell.
   */
  embedded?: boolean;
}>;

/**
 * Owns the owner settlements workspace body. Shared verbatim between the
 * standalone /owner-settlements route and the embedded finance hub tab so
 * business logic, queries, and mutations are never duplicated.
 */
export function OwnerSettlementsWorkspace({ embedded = false }: OwnerSettlementsWorkspaceProps) {
  return (
    <EmbeddableWorkspace
      embedded={embedded}
      title="تسويات الملاك"
      description="إعداد تسويات كل مالك عن الفترة، اعتمادها للصرف، وتنفيذ دفعات الصافي المستحق مع مستندات الطباعة."
    >
      <OwnerSettlementWorkspace />
    </EmbeddableWorkspace>
  );
}

export function OwnerSettlementsPage() {
  return <OwnerSettlementsWorkspace />;
}

export default OwnerSettlementsPage;
