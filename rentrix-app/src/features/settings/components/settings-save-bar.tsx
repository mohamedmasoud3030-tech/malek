import { RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';

export function SettingsSaveBar({
  isDirty,
  isSaving,
  onDiscard,
}: Readonly<{
  isDirty: boolean;
  isSaving: boolean;
  onDiscard: () => void;
}>) {
  return (
    <section
      className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm md:sticky md:top-4 md:z-20"
      aria-label="حالة حفظ الإعدادات"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black">مسودة إعدادات المكتب</p>
            <StatusBadge tone={isDirty ? 'warning' : 'success'}>
              {isDirty ? 'تغييرات غير محفوظة' : 'محفوظة'}
            </StatusBadge>
          </div>
          <p className="mt-1 text-xs font-bold leading-5 text-muted-foreground" aria-live="polite">
            {isDirty
              ? 'احفظ التغييرات لتطبيقها، أو تراجع للعودة إلى آخر نسخة محفوظة.'
              : 'لا توجد تغييرات معلقة على إعدادات المكتب.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Button
            type="button"
            variant="secondary"
            disabled={!isDirty || isSaving}
            onClick={onDiscard}
          >
            <RotateCcw className="me-2 size-4" aria-hidden="true" />
            تراجع
          </Button>
          <Button
            type="submit"
            form="settings-company-form"
            disabled={!isDirty || isSaving}
          >
            <Save className="me-2 size-4" aria-hidden="true" />
            {isSaving ? 'جارٍ الحفظ...' : 'حفظ'}
          </Button>
        </div>
      </div>
    </section>
  );
}
