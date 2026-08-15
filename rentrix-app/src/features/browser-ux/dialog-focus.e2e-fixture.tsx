import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * E2E fixture for the shared Dialog focus-restoration contract (WP-06 / GAP-020).
 *
 * Covers the real-world open patterns that cannot be exercised through a single
 * trigger: two independent launch buttons, a nested dialog opened from inside
 * another dialog, a launcher that unmounts while its dialog is open, and rapid
 * open/close cycles. Everything here renders under /login in VITE_E2E mode and
 * needs no Supabase.
 */
export function DialogFocusE2EFixture() {
  const [dialogAOpen, setDialogAOpen] = useState(false);
  const [dialogBOpen, setDialogBOpen] = useState(false);
  const [nestedOpen, setNestedOpen] = useState(false);
  const [launcherAVisible, setLauncherAVisible] = useState(true);

  return (
    <main dir="rtl" className="min-h-dvh bg-background p-6 text-foreground" data-e2e-dialog-focus>
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-xl font-bold">تركيز الحوارات — سطح اختبار معزول</h1>

        <div className="flex flex-wrap gap-3">
          {launcherAVisible ? (
            <Button
              type="button"
              data-e2e-launcher-a
              className="min-h-11"
              onClick={() => setDialogAOpen(true)}
            >
              فتح النموذج أ
            </Button>
          ) : null}
          <Button
            type="button"
            data-e2e-launcher-b
            className="min-h-11"
            onClick={() => setDialogBOpen(true)}
          >
            فتح النموذج ب
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => setLauncherAVisible((visible) => !visible)}
          >
            إظهار/إخفاء زر أ
          </Button>
        </div>

        {/* Dialog A — contains a nested-dialog opener */}
        <Dialog open={dialogAOpen} onOpenChange={setDialogAOpen}>
          <DialogContent data-e2e-dialog-a className="max-w-lg">
            <DialogHeader>
              <DialogTitle>النموذج أ</DialogTitle>
              <DialogDescription>حوار أ مع حوار متداخل.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <p>محتويات النموذج أ</p>
              <Button
                type="button"
                variant="secondary"
                data-e2e-nested-trigger
                className="min-h-11"
                onClick={() => setNestedOpen(true)}
              >
                فتح تأكيد متداخل
              </Button>
              <Button
                type="button"
                variant="secondary"
                data-e2e-hide-launcher-inside
                className="min-h-11"
                onClick={() => setLauncherAVisible(false)}
              >
                إخفاء زر أ (داخل الحوار)
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Nested dialog opened from inside dialog A */}
        <Dialog open={nestedOpen} onOpenChange={setNestedOpen}>
          <DialogContent data-e2e-dialog-nested className="max-w-sm">
            <DialogHeader>
              <DialogTitle>تأكيد متداخل</DialogTitle>
              <DialogDescription>حوار داخل حوار.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Button
                type="button"
                variant="danger"
                data-e2e-nested-confirm
                className="min-h-11"
                onClick={() => setNestedOpen(false)}
              >
                تأكيد
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="min-h-11"
                onClick={() => setNestedOpen(false)}
              >
                إلغاء
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog B — independent launcher */}
        <Dialog open={dialogBOpen} onOpenChange={setDialogBOpen}>
          <DialogContent data-e2e-dialog-b className="max-w-lg">
            <DialogHeader>
              <DialogTitle>النموذج ب</DialogTitle>
              <DialogDescription>حوار ب بمطلق مستقل.</DialogDescription>
            </DialogHeader>
            <p>محتويات النموذج ب</p>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
