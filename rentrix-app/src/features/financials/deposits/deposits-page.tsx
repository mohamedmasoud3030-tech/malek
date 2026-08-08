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
      visualVariant="malek-pro"
      title="التأمينات"
      description="أمانات وتأمينات المستأجرين: الاستلام، الخصومات، الاسترداد ومستندات التسوية في سجل واحد."
    >
      <DepositsWorkspaceBody />
    </EmbeddableWorkspace>
  );
}

export function DepositsPage() {
  return <DepositsWorkspace />;
}

export default DepositsPage;
