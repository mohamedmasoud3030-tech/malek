import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EntityForm, type ResponsiveFormSurface } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface EntityFormE2EFixtureProps {
  mobileSurface?: Exclude<ResponsiveFormSurface, 'dialog'>;
}

export function EntityFormE2EFixture({ mobileSurface = 'bottom-sheet' }: EntityFormE2EFixtureProps) {
  const [open, setOpen] = useState(true);
  const [nameError, setNameError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('full_name') ?? '').trim();
    setNameError(name ? null : 'الاسم مطلوب');
  };

  return (
    <main dir="rtl" className="min-h-dvh bg-background p-3 text-foreground sm:p-6" data-e2e-form-contract>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <h1 className="text-xl font-black">اختبار عقد الفورم المشترك</h1>
          <p className="mt-1 text-sm text-muted-foreground">سطح متصفح معزول لا يتصل ببيانات أو مصادقة أو عمليات مالية.</p>
          <Button className="mt-4" onClick={() => setOpen(true)}>فتح النموذج</Button>
        </div>

        <EntityForm.Overlay
          open={open}
          onOpenChange={setOpen}
          title="إضافة جهة اتصال"
          description="مثال منخفض المخاطر لاختبار الكيبورد والتمرير والأخطاء وsafe-area."
          mobileSurface={mobileSurface}
        >
          <EntityForm.Root onSubmit={handleSubmit}>
            <EntityForm.Field label="الاسم الكامل" error={nameError}>
              <Input
                name="full_name"
                aria-invalid={nameError ? 'true' : 'false'}
                placeholder="اكتب الاسم"
                autoComplete="name"
              />
            </EntityForm.Field>
            <EntityForm.Field label="البريد الإلكتروني">
              <Input name="email" type="email" inputMode="email" placeholder="name@example.com" />
            </EntityForm.Field>
            <EntityForm.Field label="رقم الهاتف">
              <Input name="phone" type="tel" inputMode="tel" placeholder="+968" />
            </EntityForm.Field>
            {Array.from({ length: 7 }, (_, index) => (
              <EntityForm.Field key={index} label={`حقل إضافي ${index + 1}`}>
                <Input name={`extra_${index + 1}`} placeholder={`قيمة ${index + 1}`} />
              </EntityForm.Field>
            ))}
            <EntityForm.Field label="آخر حقل في النموذج">
              <Textarea name="notes" data-e2e-last-field placeholder="يجب أن يبقى ظاهرًا فوق شريط الإجراءات" rows={4} />
            </EntityForm.Field>
            <EntityForm.Actions submitLabel="حفظ تجريبي" onCancel={() => setOpen(false)} />
          </EntityForm.Root>
        </EntityForm.Overlay>
      </div>
    </main>
  );
}