import { Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ContractListHeader({
  canExport,
  onCreate,
  onExport,
}: {
  canExport: boolean;
  onCreate: () => void;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">العقود</h2>
        <p className="text-sm text-muted-foreground">إدارة دورة العقد من مسودة إلى نشط ثم منتهي أو ملغي.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onExport} disabled={!canExport}>
          <Download className="me-2 size-4" />
          تصدير CSV
        </Button>
        <Button onClick={onCreate}>
          <Plus className="me-2 size-4" />إنشاء عقد
        </Button>
      </div>
    </div>
  );
}
