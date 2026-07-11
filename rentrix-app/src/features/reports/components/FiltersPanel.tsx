import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { Owner } from '@/features/owners/ownerService';
import type { CostCenterRecord } from '@/features/settings/costCenterService';
import type { FilterState } from '../reports-page.helpers';

export function FiltersPanel({ filters, costCenterRows, ownerRows, contractRows, onChange, onResetCurrentMonth }: Readonly<{
  filters: FilterState;
  costCenterRows: CostCenterRecord[];
  ownerRows: Owner[];
  contractRows: ContractListItem[];
  onChange: (filters: FilterState) => void;
  onResetCurrentMonth: () => void;
}>) {
  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-3 px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black">فلترة الفترة</p>
            <CardDescription>حدد من/إلى لاحتساب الفترة، وتاريخ "الاحتساب" لحساب المتأخرات وأعمار الذمم.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-5">
        <FilterBar
            filters={(
              <>
                <label className="min-w-0 flex-1 space-y-1 text-sm font-bold sm:min-w-32"><span className="sr-only">من تاريخ</span><Input aria-label="من تاريخ" type="date" value={filters.from} onChange={(event) => onChange({ ...filters, from: event.target.value })} /></label>
                <label className="min-w-0 flex-1 space-y-1 text-sm font-bold sm:min-w-32"><span className="sr-only">إلى تاريخ</span><Input aria-label="إلى تاريخ" type="date" value={filters.to} onChange={(event) => onChange({ ...filters, to: event.target.value })} /></label>
                <label className="min-w-0 flex-1 space-y-1 text-sm font-bold sm:min-w-32"><span className="sr-only">تاريخ الاحتساب</span><Input aria-label="تاريخ الاحتساب" type="date" value={filters.asOf} onChange={(event) => onChange({ ...filters, asOf: event.target.value })} /></label>
                <Select aria-label="مركز التكلفة" value={filters.costCenterId} onChange={(event) => onChange({ ...filters, costCenterId: event.target.value })}>
                  <option value="">كل مراكز التكلفة</option>
                  {costCenterRows.filter((costCenter) => costCenter.is_active !== false).map((costCenter) => <option key={costCenter.id} value={costCenter.id}>{costCenter.name}</option>)}
                </Select>
                <Select aria-label="المالك للكشف" value={filters.ownerId} onChange={(event) => onChange({ ...filters, ownerId: event.target.value })}>
                  <option value="">اختر مالكًا</option>
                  {ownerRows.map((owner) => <option key={owner.id} value={owner.id}>{owner.display_name ?? owner.full_name}</option>)}
                </Select>
                <Select aria-label="العقد لكشف المستأجر" value={filters.contractId} onChange={(event) => onChange({ ...filters, contractId: event.target.value })}>
                  <option value="">اختر عقدًا</option>
                  {contractRows.map((contract) => <option key={contract.id} value={contract.id}>{(contract.people?.full_name ?? 'مستأجر غير محدد')} · {(contract.properties?.title ?? 'عقار غير محدد')} · {contract.id.slice(0, 8)}</option>)}
                </Select>
                <Button className="w-full sm:w-auto" onClick={onResetCurrentMonth} variant="secondary"><RefreshCcw className="me-2 size-4" />الشهر الحالي</Button>
              </>
            )}
          />
        </CardContent>
    </Card>
  );
}
