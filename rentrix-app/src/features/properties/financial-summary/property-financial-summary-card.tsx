import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PropertyFinancialSummaryCard() {
  return (
    <Card className="rounded-2xl border-dashed border-2 bg-card">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs font-bold text-muted-foreground">الحسابات والوضع المالي</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
        سيظهر الملخص المالي هنا عند توفر بيانات مالية مرتبطة بالعقار.
      </CardContent>
    </Card>
  );
}
