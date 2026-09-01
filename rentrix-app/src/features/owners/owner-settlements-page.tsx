import { useNavigate, useSearch } from '@tanstack/react-router';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { Button } from '@/components/ui/button';
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
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const ownerId = typeof search.ownerId === 'string' && search.ownerId.trim()
    ? search.ownerId.trim()
    : undefined;

  const clearOwnerScope = () => {
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => {
        const next = { ...previous };
        delete next.ownerId;
        return next;
      },
      replace: true,
    });
  };

  return (
    <EmbeddableWorkspace
      embedded={embedded}
      title="تسويات الملاك"
      description="إعداد تسويات كل مالك عن الفترة، اعتمادها للصرف، وتنفيذ دفعات الصافي المستحق مع مستندات الطباعة."
    >
      {ownerId ? (
        <div
          role="status"
          data-owner-settlement-scope={ownerId}
          className="mb-4 flex flex-wrap items-center justify-between gap-3 border-y border-primary/25 py-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-black">تسويات المالك المحدد</p>
            <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
              السجل وخيارات إنشاء التسوية مقيدة بالمالك القادم من ملفه؛ لا تظهر تسويات ملاك آخرين داخل هذه الرحلة.
            </p>
          </div>
          <Button type="button" variant="secondary" className="min-h-11 shrink-0" onClick={clearOwnerScope}>
            عرض كل الملاك
          </Button>
        </div>
      ) : null}
      <OwnerSettlementWorkspace ownerId={ownerId} />
    </EmbeddableWorkspace>
  );
}

export function OwnerSettlementsPage() {
  return <OwnerSettlementsWorkspace />;
}

export default OwnerSettlementsPage;
