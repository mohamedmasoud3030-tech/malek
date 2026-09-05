import { ReportsCatalog } from './components/ReportsCatalog';

/** Lightweight authenticated-shell fixture for the canonical Reports catalog. */
export function ReportsProductE2EFixture() {
  return (
    <main data-e2e-reports-products dir="rtl" lang="ar" className="min-w-0 p-3">
      <ReportsCatalog />
    </main>
  );
}
