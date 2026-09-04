import { useRef } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { DepositsWorkspace as DepositsWorkspaceBody, type DepositsWorkspaceHandle } from './deposits-workspace';

export type DepositsWorkspaceProps = Readonly<{
  /**
   * embedded: rendered inside the finance hub, which already supplies the page
   * shell — the workspace body renders without a second layout or header.
   * standalone (default): reached via a compatibility deep link, so it owns
   * the page shell.
   */
  embedded?: boolean;
}>;

/**
 * One canonical deposits workspace shared by direct compatibility routes and
 * the finance hub. Desktop renders a register/table; mobile renders cards.
 * The create action lives in the workspace header (hub actions row when
 * embedded, page-header action when standalone), so the register never needs
 * a second title-and-button strip of its own.
 */
export function DepositsWorkspace({ embedded = false }: DepositsWorkspaceProps) {
  const bodyRef = useRef<DepositsWorkspaceHandle>(null);

  return (
    <EmbeddableWorkspace
      embedded={embedded}
      title="تأمينات المستأجرين"
      workspaceName="deposits"
      viewModeStorageKey="malek:deposits:register-view-mode-v1"
      primaryAction={(
        <Button className="min-h-11" onClick={() => bodyRef.current?.openCreateForm()}>
          <Plus className="me-2 size-4" aria-hidden="true" />
          تسجيل وديعة جديدة
        </Button>
      )}
    >
      <DepositsWorkspaceBody ref={bodyRef} />
    </EmbeddableWorkspace>
  );
}
