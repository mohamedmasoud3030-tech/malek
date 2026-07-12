import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { Owner } from '@/features/owners/ownerService';
import type { CostCenterRecord } from '@/features/settings/costCenterService';
import type { FilterState } from '../reports-page.helpers';

export function FiltersPanel({
  filters,
  costCenterRows,
  ownerRows,
  contractRows,
  onChange,
  onResetCurrentMonth,
}: Readonly<{
  filters: FilterState;
  costCenterRows: CostCenterRecord[];
  ownerRows: Owner[];
  contractRows: ContractListItem[];
  onChange: (filters: FilterState) => void;
  onResetCurrentMonth: () => void;
}>) {
  const selectedCostCenter = costCenterRows.find((row) => row.id === filters.costCenterId)?.name;
  const selectedOwner = ownerRows.find((row) => row.id === filters.ownerId);
  const selectedContract = contractRows.find((row) => row.id === filters.contractId);

  return (
    <div className="space-y-3">
      <FilterBar
        filters={(
          <>
            <label className="min-w-0 space-y-1 text-sm font-bold">
              <span className="sr-only">من تاريخ</span>
              <Input aria-label="من تاريخ" type="date" value={filters.from} onChange={(event) => onChange({ ...filters, from: event.target.value })} />
            </label>
            <label className="min-w-0 space-y-1 text-sm font-bold">
              <span className="sr-only">إلى تاريخ</span>
              <Input aria-label="إلى تاريخ" type="date" value={filters.to} onChange={(event) => onChange({ ...filters, to: event.target.value })} />
            </label>
            <label className="min-w-0 space-y-1 text-sm font-bold">
              <span className="sr-only">تاريخ الاحتساب</span>
              <Input aria-label="تاريخ الاحتساب" type="date" value={filters.asOf} onChange={(event) => onChange({ ...filters, asOf: event.target.value })} />
            </label>
            <Select aria-label="مركز التكلفة" value={filters.costCenterId} onChange={(event) => onChange({ ...filters, costCenterId: event.target.value })}>
              <option value="">كل مراكز التكلفة</option>
              {costCenterRows.filter((costCenter) => costCenter.is_active !== false).map((costCenter) => (
                <option key={costCenter.id} value={costCenter.id}>{costCenter.name}</option>
              ))}
            </Select>
            <Select aria-label="المالك للكشف" value={filters.ownerId} onChange={(event) => onChange({ ...filters, ownerId: event.target.value })}>
              <option value="">كل الملاك</option>
              {ownerRows.map((owner) => <option key={owner.id} value={owner.id}>{owner.display_name ?? owner.full_name}</option>)}
            </Select>
            <Select aria-label="العقد لكشف المستأجر" value={filters.contractId} onChange={(event) => onChange({ ...filters, contractId: event.target.value })}>
              <option value="">كل العقود</option>
              {contractRows.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {(contract.people?.full_name ?? 'مستأجر غير محدد')} · {(contract.properties?.title ?? 'عقار غير محدد')} · {contract.id.slice(0, 8)}
                </option>
              ))}
            </Select>
          </>
        )}
        actions={(
          <Button onClick={onResetCurrentMonth} variant="secondary">
            <RefreshCcw className="me-2 size-4" aria-hidden="true" />
            الشهر الحالي
          </Button>
        )}
      />

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-muted/30 px-3 py-2 text-[11px] font-bold text-muted-foreground" aria-live="polite">
        <span>الفترة: {filters.from || '—'} إلى {filters.to || '—'}</span>
        <span aria-hidden="true">•</span>
        <span>الاحتساب: {filters.asOf || '—'}</span>
        {selectedCostCenter ? <><span aria-hidden="true">•</span><span>مركز التكلفة: {selectedCostCenter}</span></> : null}
        {selectedOwner ? <><span aria-hidden="true">•</span><span>المالك: {selectedOwner.display_name ?? selectedOwner.full_name}</span></> : null}
        {selectedContract ? <><span aria-hidden="true">•</span><span>العقد: {selectedContract.id.slice(0, 8)}</span></> : null}
      </div>
    </div>
  );
}
