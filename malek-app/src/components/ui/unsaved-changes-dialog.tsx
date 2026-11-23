import { ConfirmDialog } from './confirm-dialog';

type Props = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}>;

/** Canonical warning shown before discarding edits in dialogs or route changes. */
export function UnsavedChangesDialog({ open, onOpenChange, onConfirm }: Props) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="تغييرات غير محفوظة"
      description="هناك تغييرات لم تحفظ. إذا غادرت الآن سوف تفقد هذه التغييرات."
      confirmLabel="تجاهل التغييرات"
      cancelLabel="مواصلة التعديل"
      variant="warning"
      onConfirm={onConfirm}
    />
  );
}
