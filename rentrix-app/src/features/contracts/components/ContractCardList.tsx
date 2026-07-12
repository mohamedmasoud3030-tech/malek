import { useNavigate } from '@tanstack/react-router';
import { Calendar, Clock, Edit, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityCard } from '@/components/ui/entity-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { getContractNumber } from '../contractListExport';
import { formatContractDate, formatContractMoney } from '../contractDisplayFormatters';
import type { ContractListItem } from '../services/contractService';
import { getDaysUntilEnd, isExpiringSoon } from '../hooks/useContractFilters';


const contractStatusTone: Record<string, { label: string; tone: 'blue' | 'green' | 'red' | 'gray' | 'gold' }> = {
  ACTIVE: { label: 'نشط', tone: 'green' },
  EXPIRED: { label: 'منتهي', tone: 'gold' },
  TERMINATED: { label: 'مُنهى', tone: 'red' },
  DRAFT: { label: 'مسودة', tone: 'gray' },
};

function contractUrgencyClassName(daysRemaining: number) {
  if (daysRemaining <= 7) return 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300';
  if (daysRemaining <= 30) return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300';
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
}

export function ContractCardList({
  companySettings,
  contracts,
  onDelete,
  onEdit,
}: {
  companySettings: CompanySettingsContract;
  contracts: ContractListItem[];
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="grid gap-3 sm:grid-cols-2 md:hidden">
      {contracts.map((contract) => {
        const expiringSoon = isExpiringSoon(contract);
        const daysUntilEnd = getDaysUntilEnd(contract);
        const normalizedStatus = contract.status.toUpperCase();
        const statusMeta = contractStatusTone[normalizedStatus] ?? contractStatusTone.DRAFT;

        return (
          <div key={contract.id} className="space-y-1.5">
            <EntityCard
              id={contract.id}
              name={contract.people?.full_name ?? '—'}
              subtitle={contract.units?.unit_number ?? contract.properties?.title ?? '—'}
              supportingText={`عقد #${getContractNumber(contract)}`}
              avatarIcon={User}
              badge={<StatusBadge tone={statusMeta.tone} className="shrink-0">{statusMeta.label}</StatusBadge>}
              className={cn(daysUntilEnd !== null && daysUntilEnd <= 7 && normalizedStatus === 'ACTIVE' && 'border-rose-300 dark:border-rose-800')}
              onClick={() => navigate({ to: '/contracts/$contractId', params: { contractId: contract.id } })}
              stats={(
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="size-3.5 shrink-0" />
                    <span>{formatContractDate(companySettings, contract.end_date)}</span>
                  </div>
                  {normalizedStatus === 'ACTIVE' && (
                    <div className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', contractUrgencyClassName(daysUntilEnd ?? 0))}>
                      <Clock className="size-3" />
                      {(daysUntilEnd ?? 0) <= 0 ? 'انتهى' : `${daysUntilEnd ?? 0} يوم`}
                    </div>
                  )}
                  <p className="text-sm font-black text-primary">{formatContractMoney(companySettings, contract.rent_amount)}</p>
                </div>
              )}
            />
            {expiringSoon && (
              <p className="px-1 text-xs font-bold text-amber-700">ينتهي خلال {daysUntilEnd} يوم</p>
            )}
            <div className="flex items-center justify-end gap-2 px-1">
              <Button variant="secondary" className="min-h-11" onClick={() => onEdit(contract.id)}>
                <Edit className="size-3.5 me-1" />تعديل
              </Button>
              <Button
                variant="danger"
                className="min-h-11"
                aria-label={`حذف العقد ${getContractNumber(contract)}`}
                onClick={() => onDelete(contract.id)}
              >
                <Trash2 className="size-3.5 me-1" />حذف
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
