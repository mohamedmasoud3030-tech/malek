import React from 'react';
import { Link } from '@tanstack/react-router';
import { Plus, FileText, Wrench, FolderKanban, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  usePropertyActivityTab,
  usePropertyContractsTab,
  usePropertyInvoicesTab,
  usePropertyMaintenanceTab,
  usePropertyTabPermissions,
  type PropertyActivityRecord,
} from '../use-property-workspace-tabs';

export interface PropertyTabProps {
  propertyId: string;
}

export function PropertyContractsTab({ propertyId }: PropertyTabProps) {
  const { canWriteContract } = usePropertyTabPermissions();
  const { data, isLoading, isError, error, refetch } = usePropertyContractsTab(propertyId);

  const propertyContracts = data ?? [];

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">جارٍ تحميل العقود والمستأجرين...</div>;
  }

  if (isError) {
    return (
      <Card role="alert" className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-center justify-between p-4">
          <p className="text-sm font-bold text-destructive">
            {error instanceof Error ? error.message : 'تعذر تحميل بيانات العقود.'}
          </p>
          <Button size="sm" variant="secondary" onClick={() => refetch()}>إعادة المحاولة</Button>
        </CardContent>
      </Card>
    );
  }

  if (propertyContracts.length === 0) {
    return (
      <Card className="border-border bg-muted/20">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-3">
          <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
          <div>
            <h3 className="font-bold text-foreground">لا توجد عقود إيجار مسجلة لهذا العقار حالياً</h3>
            <p className="mt-1 text-xs text-muted-foreground">قم بإنشاء عقد إيجار لربط المستأجر بالوحدة العقارية وبدء التحصيل.</p>
          </div>
          {canWriteContract ? (
            <Button size="sm" asChild>
              <Link to="/contracts/new">
                <Plus className="me-1.5 size-4" />
                إضافة عقد إيجار
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">عقود العقار والمستأجرون ({propertyContracts.length})</h3>
        {canWriteContract ? (
          <Button size="sm" asChild>
            <Link to="/contracts/new">
              <Plus className="me-1.5 size-4" />
              إضافة عقد إيجار
            </Link>
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {propertyContracts.map((contract) => (
          <Card key={contract.id} className="transition-shadow hover:shadow-sm">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">{contract.people?.full_name ?? 'مستأجر'}</span>
                <StatusBadge tone={contract.status === 'active' ? 'success' : 'neutral'}>
                  {contract.status === 'active' ? 'نشط' : contract.status}
                </StatusBadge>
              </div>
              <p className="text-xs text-muted-foreground">
                الوحدة: {contract.units?.unit_number ?? '—'} | الإيجار: {Number(contract.rent_amount ?? 0).toLocaleString()} OMR
              </p>
              <p className="text-xs text-muted-foreground">
                الفترة: {contract.start_date} إلى {contract.end_date}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function PropertyFinancialsTab({ propertyId }: PropertyTabProps) {
  const { data, isLoading, isError, error, refetch } = usePropertyInvoicesTab(propertyId);

  const propertyInvoices = data ?? [];

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">جارٍ تحميل البيانات المالية...</div>;
  }

  if (isError) {
    return (
      <Card role="alert" className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-center justify-between p-4">
          <p className="text-sm font-bold text-destructive">
            {error instanceof Error ? error.message : 'تعذر تحميل فواتير العقار.'}
          </p>
          <Button size="sm" variant="secondary" onClick={() => refetch()}>إعادة المحاولة</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">الفواتير والتحصيلات الخاصة بالعقار</h3>
        <Button size="sm" variant="outline" asChild>
          <Link to="/invoices">مراجعة الفواتير الشاملة</Link>
        </Button>
      </div>
      {propertyInvoices.length === 0 ? (
        <Card className="border-border bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-2">
            <p className="font-bold text-foreground">لا توجد فواتير أو حركات مالية مسجلة لهذا العقار</p>
            <p className="text-xs text-muted-foreground">سيظهر الملخص المالي والفواتير المستحقة فور تفعيل عقود الإيجار.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {propertyInvoices.slice(0, 10).map((invoice) => (
            <Card key={invoice.id} className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">فاتورة رقم #{invoice.id.slice(0, 8)}</span>
                <StatusBadge tone={invoice.status === 'paid' ? 'success' : 'warning'}>
                  {invoice.status === 'paid' ? 'مدفوعة' : invoice.status}
                </StatusBadge>
              </div>
              <p className="text-xs text-muted-foreground">
                المبلغ: {Number(invoice.amount ?? 0).toLocaleString()} OMR | تاريخ الاستحقاق: {invoice.due_date}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function PropertyMaintenanceTab({ propertyId }: PropertyTabProps) {
  const { canWriteMaintenance } = usePropertyTabPermissions();
  const { data: requests, isLoading, isError, error, refetch } = usePropertyMaintenanceTab(propertyId);

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">جارٍ تحميل طلبات الصيانة...</div>;
  }

  if (isError) {
    return (
      <Card role="alert" className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-center justify-between p-4">
          <p className="text-sm font-bold text-destructive">
            {error instanceof Error ? error.message : 'تعذر تحميل طلبات الصيانة.'}
          </p>
          <Button size="sm" variant="secondary" onClick={() => refetch()}>إعادة المحاولة</Button>
        </CardContent>
      </Card>
    );
  }

  const items = requests ?? [];

  if (items.length === 0) {
    return (
      <Card className="border-border bg-muted/20">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-3">
          <Wrench className="size-8 text-muted-foreground" aria-hidden="true" />
          <div>
            <h3 className="font-bold text-foreground">لا توجد طلبات صيانة مسجلة لهذا العقار</h3>
            <p className="mt-1 text-xs text-muted-foreground">جميع وحدات ومرافق العقار بحالة تشغيلية جيدة حالياً.</p>
          </div>
          {canWriteMaintenance ? (
            <Button size="sm" variant="outline" asChild>
              <Link to="/maintenance">إدارة الصيانة</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">سجل الصيانة والمرافق ({items.length})</h3>
        {canWriteMaintenance ? (
          <Button size="sm" variant="outline" asChild>
            <Link to="/maintenance">إدارة الصيانة</Link>
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Card key={item.id} className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">{item.title ?? 'طلب صيانة'}</span>
              <StatusBadge tone={item.status === 'resolved' ? 'success' : 'warning'}>
                {item.status === 'resolved' ? 'مكتمل' : item.status}
              </StatusBadge>
            </div>
            <p className="text-xs text-muted-foreground">
              الأولوية: {item.priority ?? 'medium'} | التاريخ: {item.scheduled_date ?? '—'}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function PropertyDocumentsTab({ propertyId }: PropertyTabProps) {
  return (
    <Card className="border-border bg-muted/20">
      <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-3">
        <FolderKanban className="size-8 text-muted-foreground" aria-hidden="true" />
        <div>
          <h3 className="font-bold text-foreground">أرشيف المستندات والمرفقات الخاصة بالعقار</h3>
          <p className="mt-1 text-xs text-muted-foreground">يمكنك استعراض وإرفاق العقود والمستندات القانونية من خزينة المستندات الموحدة.</p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link to="/documents-vault">فتح خزينة المستندات</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function PropertyActivityTab({ propertyId }: PropertyTabProps) {
  const { data, isLoading, isError, error, refetch } = usePropertyActivityTab(propertyId);

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">جارٍ تحميل سجل النشاط والحوكمة...</div>;
  }

  if (isError) {
    return (
      <Card role="alert" className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-center justify-between p-4">
          <p className="text-sm font-bold text-destructive">
            {error instanceof Error ? error.message : 'تعذر تحميل سجل النشاط.'}
          </p>
          <Button size="sm" variant="secondary" onClick={() => refetch()}>إعادة المحاولة</Button>
        </CardContent>
      </Card>
    );
  }

  const records = data ?? [];

  if (records.length === 0) {
    return (
      <Card className="border-border bg-muted/20">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-2">
          <ShieldCheck className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-bold text-foreground">لم تُسجل أحداث حوكمة حديثة على هذا العقار بعد</p>
          <p className="text-xs text-muted-foreground">كل عملية إضافة أو تعديل في بيانات العقار أو الملكية توثق هنا تلقائياً.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground">سجل النشاط والحوكمة ({records.length})</h3>
      <div className="space-y-2">
        {records.slice(0, 15).map((record: PropertyActivityRecord) => (
          <Card key={record.id} className="p-3 text-xs flex items-center justify-between">
            <div>
              <span className="font-bold text-foreground">{record.action}: </span>
              <span className="text-muted-foreground">{record.description ?? 'حركة موثقة'}</span>
            </div>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">{record.occurredAt.slice(0, 10)}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
