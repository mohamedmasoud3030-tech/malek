import { RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

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
      className={cn(
        'sticky bottom-[calc(0.5rem+env(safe-area-inset-bottom,0px))] z-30 rounded-2xl border p-2.5 shadow-lg backdrop-blur-xl md:bottom-auto md:top-4 md:p-3',
        isDirty
          ? 'border-warning/30 bg-card/95 ring-1 ring-warning/10'
          : 'border-border/70 bg-card/92',
      )}
      aria-label="حالة حفظ الإعدادات"
    >
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black sm:text-sm">مسودة إعدادات المكتب</p>
            <StatusBadge tone={isDirty ? 'warning' : 'success'}>
              {isDirty ? 'تغييرات غير محفوظة' : 'محفوظة'}
            </StatusBadge>
          </div>
          <p className="mt-0.5 hidden text-xs font-bold leading-5 text-muted-foreground sm:block" aria-live="polite">
            {isDirty
              ? 'احفظ التغييرات لتطبيقها، أو تراجع للعودة إلى آخر نسخة محفوظة.'
              : 'لا توجد تغييرات معلقة على إعدادات المكتب.'}
          </p>
        </div>

        <div className="flex shrink-0 gap-1.5 sm:gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11 px-3"
            disabled={!isDirty || isSaving}
            onClick={onDiscard}
          >
            <RotateCcw className="size-4 sm:me-2" aria-hidden="true" />
            <span className="hidden sm:inline">تراجع</span>
          </Button>
          <Button
            type="submit"
            form="settings-company-form"
            size="sm"
            className="min-h-11 px-3 sm:px-4"
            disabled={!isDirty || isSaving}
          >
            <Save className="size-4 sm:me-2" aria-hidden="true" />
            <span>{isSaving ? 'جارٍ الحفظ...' : 'حفظ'}</span>
          </Button>
        </div>
      </div>
    </section>
  );
}
