import { CalendarRange, Link2, Scale } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { ReportList, ReportListRow, ReportPanel, ReportState } from './report-section-primitives';

export function DeferredRevenueReportSection({ isLoading }: Readonly<{ isLoading: boolean }>) {
  return (
    <ReportPanel
      title="الإيرادات المؤجلة والاستحقاق"
      description="توزيع التحصيلات المقدمة على مدة العقد بعد التحقق من ارتباط التحصيل بالعقد."
      icon={Scale}
      isLoading={isLoading}
      action={<StatusBadge tone="gold">بانتظار مصدر موثّق</StatusBadge>}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <ReportState message="لا توجد حاليًا بيانات تحصيلات مقدمة مرتبطة بالعقد بمصدر موثّق يكفي لحساب الاستحقاق. أُزيلت الأرقام والعقود التجريبية، ولن يعرض Rentrix قيمًا تقديرية داخل تقرير مالي." />

        <div className="rounded-xl border border-border/70 bg-muted/20">
          <ReportList>
            <ReportListRow
              title="العقد وفترة الاستحقاق"
              subtitle="تاريخ البداية والنهاية من العقد الحقيقي"
              value={<CalendarRange className="size-4 text-primary" aria-hidden="true" />}
            />
            <ReportListRow
              title="التحصيل المقدم"
              subtitle="دفعة منشورة ومربوطة صراحة بالعقد"
              value={<Link2 className="size-4 text-primary" aria-hidden="true" />}
            />
            <ReportListRow
              title="جدول الاعتراف الشهري"
              subtitle="يُحسب فقط بعد اكتمال المصدرين السابقين"
              value={<Scale className="size-4 text-primary" aria-hidden="true" />}
            />
          </ReportList>
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          هذا التبويب محفوظ في مكانه ولا يخفي الوظيفة، لكنه يفشل بأمان بدل استخدام بيانات وهمية أو افتراض أن قيمة الإيجار تساوي تحصيلًا مقدمًا.
        </p>
      </div>
    </ReportPanel>
  );
}
