import { AccessDenied } from '@/components/layout/access-denied';
import { EmptyState } from '@/components/ui/state-surfaces';
import { DataErrorScreen } from '@/components/data-error-screen';
import { LoadingScreen } from '@/components/loading-screen';
import { Button } from '@/components/ui/button';

/**
 * E2E fixture exposing Loading / Empty / Error / Permission surfaces
 * with explicit RTL direction, used by WP-06 browser UX acceptance.
 *
 * Each surface is rendered with a stable data attribute so Playwright can
 * assert its presence without conditional fallbacks.
 */
export function StateSurfacesE2EFixture() {
  return (
    <main dir="rtl" lang="ar" className="min-h-screen bg-background p-4" data-e2e-state-surfaces>
      <h1 className="mb-6 text-xl font-bold" data-e2e-state-title>
        اختبار حالات الواجهة
      </h1>

      <section className="mb-8 space-y-4" data-e2e-state-section="loading" aria-label="حالة التحميل">
        <h2 className="text-base font-bold">حالة التحميل</h2>
        <div data-e2e-loading-surface>
          <LoadingScreen rows={3} />
        </div>
      </section>

      <section className="mb-8 space-y-4" data-e2e-state-section="empty" aria-label="حالة الفراغ">
        <h2 className="text-base font-bold">حالة الفراغ</h2>
        <div data-e2e-empty-surface>
          <EmptyState title="لا توجد سجلات" description="لم يتم العثور على أي نتائج في هذا القسم" action={<Button>إضافة جديد</Button>} />
        </div>
      </section>

      <section className="mb-8 space-y-4" data-e2e-state-section="error" aria-label="حالة الخطأ">
        <h2 className="text-base font-bold">حالة الخطأ</h2>
        <div data-e2e-error-surface>
          <DataErrorScreen title="تعذر تحميل البيانات" fallbackMessage="حدث خطأ أثناء تحميل البيانات" action={<Button>إعادة المحاولة</Button>} />
        </div>
      </section>

      <section className="mb-8 space-y-4" data-e2e-state-section="permission" aria-label="حالة الصلاحية">
        <h2 className="text-base font-bold">حالة الصلاحية</h2>
        <div data-e2e-permission-surface>
          <AccessDenied message="ليس لديك صلاحية لعرض هذا القسم." />
        </div>
      </section>
    </main>
  );
}
