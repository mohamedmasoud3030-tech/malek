import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EntityForm, type ResponsiveFormSurface } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type FixtureSurface = Exclude<ResponsiveFormSurface, 'dialog'> | 'raw-dialog';

interface EntityFormE2EFixtureProps {
  mobileSurface?: FixtureSurface;
}

export function EntityFormE2EFixture({ mobileSurface = 'bottom-sheet' }: EntityFormE2EFixtureProps) {
  const [open, setOpen] = useState(true);
  const [nameError, setNameError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('full_name') ?? '').trim();
    setNameError(name ? null : 'الاسم مطلوب');
  };

  const fixtureHeader = (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <h1 className="text-xl font-bold">اختبار عقد الفورم المشترك</h1>
      <p className="mt-1 text-sm text-muted-foreground">سطح متصفح معزول لا يتصل ببيانات أو مصادقة أو عمليات مالية.</p>
      <Button className="mt-4" onClick={() => setOpen(true)}>فتح النموذج</Button>
    </div>
  );

  if (mobileSurface === 'raw-dialog') {
    return (
      <main dir="rtl" className="min-h-dvh bg-background p-3 text-foreground sm:p-6" data-e2e-form-contract>
        <div className="mx-auto max-w-3xl space-y-4">{fixtureHeader}</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent dir="rtl" className="max-w-lg">
            <DialogHeader>
              <DialogTitle>نموذج Dialog قديم</DialogTitle>
              <DialogDescription>يثبت أن النماذج القديمة تتبع visual viewport ولوحة المفاتيح على الهاتف.</DialogDescription>
            </DialogHeader>
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-sm font-bold">
                الاسم الكامل
                <Input
                  name="full_name"
                  aria-invalid={nameError ? 'true' : 'false'}
                  placeholder="اكتب الاسم"
                />
              </label>
              {Array.from({ length: 7 }, (_, index) => (
                <label key={index} className="grid gap-2 text-sm font-bold">
                  حقل قديم {index + 1}
                  <Input name={`legacy_${index + 1}`} placeholder={`قيمة ${index + 1}`} />
                </label>
              ))}
              <label className="grid gap-2 text-sm font-bold">
                آخر حقل
                <Textarea name="notes" data-e2e-last-field rows={4} />
              </label>
              <Button type="submit">حفظ تجريبي</Button>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-dvh bg-background p-3 text-foreground sm:p-6" data-e2e-form-contract>
      <div className="mx-auto max-w-3xl space-y-4">
        {fixtureHeader}

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
