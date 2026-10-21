import { FileText } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useCompanyFormatters } from '@/hooks/useCompanyFormatters';
import { businessReferenceOrLabel } from '@/lib/business-reference';
import {
  contractStatusLabels,
  contractStatusTone,
  normalizeContractStatus,
} from '@/lib/contractStatus';


/**
 * The contracts list shared by the person dossier and the tenant dialog.
 *
 * Both surfaces list the same rows (`PartyContractContext` from
 * `listContractsForTenants`) and rendered the same markup, so it lives here
 * once. `people` is the owning feature for party identity, and the architecture
 * allow-list already lets `tenants` depend on it.
 *
 * Two caller-specific facts stay as props: the heading `id` (two dossiers can
 * render on one page, so the id must not be hard-coded) and the empty message.
 *
 * This also removes a real inconsistency: the tenant dialog printed the raw
 * `start_date`/`end_date` ISO strings while the person dossier formatted them
 * through the company formatters. Both now format, because a raw ISO date in an
 * Arabic RTL surface is a defect, not a style choice.
 */
/**
 * The minimum both dossiers guarantee. `PersonDossier['contracts']` and
 * `PartyContractContext` (the tenant dossier row) are different types — the
 * person read narrows to exactly the columns the surface renders — so the
 * shared component declares the structural contract it actually consumes
 * instead of forcing one caller's type onto the other.
 */
export type DossierContractRow = Readonly<{
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  properties: { id: string; title: string | null } | null;
  units: { id: string; unit_number: string | null } | null;
}>;

type DossierContractsSectionProps = Readonly<{
  contracts: readonly DossierContractRow[];
  headingId: string;
  emptyMessage: string;
  /** Sections rendered standalone drop the separator; the stacked view keeps it. */
  standalone: boolean;
}>;

export function DossierContractsSection({
  contracts,
  headingId,
  emptyMessage,
  standalone,
}: DossierContractsSectionProps) {
  const navigate = useNavigate();
  const companyFormatters = useCompanyFormatters();

  return (
    <section
      aria-labelledby={headingId}
      className={standalone ? undefined : 'border-t border-border/60 pt-4'}
    >
      <header className="border-b border-border/60 pb-2.5">
        <h3 id={headingId} className="flex items-center gap-2 text-base font-black">
          <FileText className="size-5 text-primary" />
          العقود والعقارات والوحدات
        </h3>
      </header>
      {contracts.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {contracts.map((contract) => (
            <li
              key={contract.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {businessReferenceOrLabel(contract, 'عقد مسجل')}
                </p>
                <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                  {contract.properties?.title ?? 'عقار غير محدد'} ·{' '}
                  {contract.units?.unit_number
                    ? `وحدة ${contract.units.unit_number}`
                    : 'بدون وحدة'}{' '}
                  · {companyFormatters.date(contract.start_date)} — {companyFormatters.date(contract.end_date)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge tone={contractStatusTone[normalizeContractStatus(contract.status)]}>
                  {contractStatusLabels[normalizeContractStatus(contract.status)]}
                </StatusBadge>
                <Button
                  variant="secondary"
                  className="min-h-11"
                  onClick={() =>
                    void navigate({
                      to: '/contracts/$contractId',
                      params: { contractId: contract.id },
                    })
                  }
                >
                  فتح العقد
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
