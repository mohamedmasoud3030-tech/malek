import { CalendarDays, ShieldAlert, WalletCards } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailFields } from '@/components/ui/detail-fields';
import { StatusBadge } from '@/components/ui/status-badge';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { formatContractDate, formatContractDateTime, formatContractDayCount, formatContractMoney, getContractInclusiveDays, getContractRemainingDays } from '../contractDisplayFormatters';
import { contractStatusLabels, contractStatusTone, paymentCycleLabels } from '../contractSchema';
import type { ContractDetail } from '../services/contractService';

type TimelineTone = 'blue' | 'green' | 'red' | 'gray' | 'gold';
type TimelineItem = Readonly<{ title: string; value: string; description: string; tone: TimelineTone }>;

export function getExpiryDescription(settings: CompanySettingsContract, contract: ContractDetail): string {
  if (contract.status === 'terminated') return 'تم إنهاء العقد ولا توجد مدة متبقية معروضة.';
  const remainingDays = getContractRemainingDays(contract.end_date);
  if (remainingDays < 0) return `انتهى منذ ${formatContractDayCount(settings, Math.abs(remainingDays))} يوم.`;
  return remainingDays === 0 ? 'ينتهي اليوم حسب تاريخ نهاية العقد.' : `باقي ${formatContractDayCount(settings, remainingDays)} يوم حتى تاريخ النهاية.`;
}

function getTimeline(settings: CompanySettingsContract, contract: ContractDetail): TimelineItem[] {
  const expiryDays = getContractRemainingDays(contract.end_date);
  return [
    { title: 'إنشاء العقد', value: formatContractDateTime(settings, contract.created_at), description: 'وقت تسجيل العقد في النظام.', tone: 'blue' },
    { title: 'تاريخ البداية', value: formatContractDate(settings, contract.start_date), description: `بداية الالتزام التجاري لمدة ${formatContractDayCount(settings, getContractInclusiveDays(contract.start_date, contract.end_date))} يوم.`, tone: 'green' },
    { title: 'تاريخ النهاية', value: formatContractDate(settings, contract.end_date), description: getExpiryDescription(settings, contract), tone: contract.status === 'terminated' ? 'red' : expiryDays < 0 ? 'gray' : expiryDays <= 30 ? 'gold' : 'green' },
    { title: 'آخر تحديث', value: formatContractDateTime(settings, contract.updated_at), description: 'آخر تعديل محفوظ على بيانات العقد.', tone: 'gray' },
  ];
}

export function ContractOverviewSection({ contract, settings }: Readonly<{ contract: ContractDetail; settings: CompanySettingsContract }>) {
  return <Card><CardHeader><CardTitle>بيانات العقد</CardTitle><CardDescription>الحقول الأساسية وربط العقار والوحدة والمستأجر.</CardDescription></CardHeader><CardContent><DetailFields fields={[{ label: 'العقد رقم', value: `#${contract.id.slice(0, 8)}` }, { label: 'المستأجر', value: contract.people?.full_name }, { label: 'الوحدة', value: contract.units?.unit_number }, { label: 'العقار', value: contract.properties?.title }, { label: 'تاريخ البداية', value: formatContractDate(settings, contract.start_date) }, { label: 'تاريخ النهاية', value: formatContractDate(settings, contract.end_date) }, { label: 'قيمة الإيجار', value: formatContractMoney(settings, contract.rent_amount) }, { label: 'دورة السداد', value: paymentCycleLabels[contract.payment_cycle] }, { label: 'الحالة', value: <StatusBadge tone={contractStatusTone[contract.status]}>{contractStatusLabels[contract.status]}</StatusBadge> }, { label: 'اتفاقية الإدارة', value: contract.agreement_id ? `#${contract.agreement_id.slice(0, 8)}` : 'لا توجد اتفاقية مرتبطة' }, { label: 'سبب الإلغاء', value: contract.status === 'terminated' ? contract.cancellation_reason?.trim() || '—' : 'غير مطبق' }, { label: 'ملاحظات', value: contract.notes, wide: true }]} /></CardContent></Card>;
}

export function ContractLifecycleSection({ contract, settings, renewalAllowed, onRenew, canTerminate, onTerminate }: Readonly<{ contract: ContractDetail; settings: CompanySettingsContract; renewalAllowed: boolean; onRenew: () => void; canTerminate: boolean; onTerminate: () => void }>) {
  return <Card className="overflow-hidden border-primary/20 bg-primary/5"><CardHeader className="bg-background/80"><CardTitle className="flex items-center gap-2"><ShieldAlert className="size-5 text-primary" />إجراءات التجديد والإنهاء</CardTitle><CardDescription>{getExpiryDescription(settings, contract)}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6"><p className="text-sm text-muted-foreground">{contract.renewed_from ? 'هذا العقد مجدد من عقد سابق.' : 'لا يوجد عقد سابق مرتبط بهذا العقد.'}</p><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">{renewalAllowed ? <Button variant="secondary" className="min-h-11" onClick={onRenew}>تجديد العقد</Button> : null}{canTerminate ? <Button variant="destructive" className="min-h-11" onClick={onTerminate}>إنهاء العقد بسبب</Button> : <Button variant="secondary" className="min-h-11" asChild><Link to="/contracts/$contractId/edit" params={{ contractId: contract.id }}>تعديل الحالة وسبب الإلغاء</Link></Button>}</div></CardContent></Card>;
}

export function ContractFinancialTimelineSection({ contract, settings }: Readonly<{ contract: ContractDetail; settings: CompanySettingsContract }>) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="size-5 text-primary" />الخط الزمني المالي</CardTitle><CardDescription>ملخص من بيانات العقد الحالية.</CardDescription></CardHeader><CardContent className="pt-6"><DetailFields columns={3} fields={[{ label: 'قيمة الإيجار', value: formatContractMoney(settings, contract.rent_amount) }, { label: 'الوحدة المؤجرة', value: contract.units?.unit_number }, { label: 'العقار', value: contract.properties?.title }]} /></CardContent></Card>;
}

export function ContractTimelineSection({ contract, settings }: Readonly<{ contract: ContractDetail; settings: CompanySettingsContract }>) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" />الخط الزمني</CardTitle></CardHeader><CardContent className="space-y-3">{getTimeline(settings, contract).map((item) => <TimelineRow item={item} key={item.title} />)}</CardContent></Card>;
}

function TimelineRow({ item }: Readonly<{ item: TimelineItem }>) { return <div className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4"><span className="mt-1 size-3 rounded-full bg-primary" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black">{item.title}</p><StatusBadge tone={item.tone}>{item.value}</StatusBadge></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p></div></div>; }
