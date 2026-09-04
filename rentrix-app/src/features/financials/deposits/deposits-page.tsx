import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { DepositsWorkspace as DepositsWorkspaceBody } from './deposits-workspace';

export type DepositsWorkspaceProps = Readonly<{
  embedded?: boolean;
}>;

/**
 * One canonical deposits workspace shared by direct compatibility routes and
 * the finance hub. Desktop renders a register/table; mobile renders cards.
 */
export function DepositsWorkspace({ embedded = false }: DepositsWorkspaceProps) {
  return (
    <EmbeddableWorkspace
      embedded={embedded}
      title="التأمينات"
    >
      <DepositsWorkspaceBody />
    </EmbeddableWorkspace>
  );
}
