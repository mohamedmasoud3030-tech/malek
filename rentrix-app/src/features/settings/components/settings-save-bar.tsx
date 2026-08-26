import { RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SettingsSaveBar({
  isDirty,
  isSaving,
  onDiscard,
}: Readonly<{
  isDirty: boolean;
  isSaving: boolean;
  onDiscard: () => void;
}>) {
  if (!isDirty) return null;

  return (
    <section
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-40 mx-auto max-w-xl rounded-2xl border border-warning/30 bg-card/95 p-2 shadow-xl ring-1 ring-warning/10 backdrop-blur-xl md:sticky md:inset-x-auto md:bottom-auto md:top-4 md:mx-0 md:max-w-none md:p-3"
      aria-label="تغييرات إعدادات غير محفوظة"
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black sm:text-sm">تغييرات غير محفوظة</p>
          <p className="mt-0.5 hidden text-xs font-bold leading-5 text-muted-foreground md:block" aria-live="polite">
            احفظ التغييرات لتطبيقها أو تراجع للعودة إلى آخر نسخة محفوظة.
          </p>
        </div>

        <div className="flex shrink-0 gap-1.5 sm:gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-10 min-w-10 px-2.5 md:min-h-11 md:px-3"
            disabled={isSaving}
            onClick={onDiscard}
            aria-label="تراجع عن التغييرات"
          >
            <RotateCcw className="size-4 md:me-2" aria-hidden="true" />
            <span className="hidden md:inline">تراجع</span>
          </Button>
          <Button
            type="submit"
            form="settings-company-form"
            size="sm"
            className="min-h-10 px-3.5 md:min-h-11 md:px-4"
            disabled={isSaving}
          >
            <Save className="size-4 sm:me-2" aria-hidden="true" />
            <span>{isSaving ? 'جارٍ الحفظ...' : 'حفظ'}</span>
          </Button>
        </div>
      </div>
    </section>
  );
}
