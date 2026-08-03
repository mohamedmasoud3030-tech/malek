import { Link } from '@tanstack/react-router';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Shared document-readiness gate notice.
 *
 * Printed documents (receipts, A4 statements, PDF exports) must never be
 * produced with fake or hardcoded company identity. Every print/PDF surface
 * uses `useDocumentSettings().isReady` as the single readiness rule (real
 * company name + currency). When the rule fails, this notice replaces the
 * output action with an Arabic explanation and a direct route to the company
 * settings page so the user can complete the required fields.
 */
export function DocumentReadinessNotice({ className }: { className?: string }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={
        'flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning-bg p-4 sm:flex-row sm:items-center sm:justify-between ' +
        (className ?? '')
      }
    >
      <p className="text-sm font-bold leading-6">
        أكمل بيانات الشركة الأساسية في الإعدادات قبل طباعة هذا المستند.
      </p>
      <Button asChild variant="secondary" size="sm" className="shrink-0">
        <Link to="/settings">
          <Settings2 className="me-2 size-4" aria-hidden="true" />
          فتح إعدادات الشركة
        </Link>
      </Button>
    </div>
  );
}
