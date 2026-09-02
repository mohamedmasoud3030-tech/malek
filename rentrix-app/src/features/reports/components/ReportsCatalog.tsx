import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { REPORT_PRODUCTS, type ReportProduct } from '../report-products';

function ReportCatalogCard({ product }: Readonly<{ product: ReportProduct }>) {
  const navigate = useNavigate();
  const Icon = product.icon;

  const openProduct = () => {
    // Real dedicated route — never a dialog over the catalog.
    void navigate({ to: '/reports/$reportId', params: { reportId: product.id } });
  };

  return (
    <article
      data-report-product={product.id}
      className="group flex min-w-0 flex-col rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-within:border-primary/50 sm:p-4"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-primary/15 bg-primary/[0.06] text-primary sm:size-10">
          <Icon className="size-4.5 sm:size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black leading-5 text-foreground sm:text-[15px]">{product.title}</h2>
          <p className="mt-0.5 truncate text-[10px] font-semibold text-muted-foreground" dir="ltr">
            {product.englishTitle}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs font-semibold leading-5 text-muted-foreground sm:text-[13px]">
        {product.description}
      </p>

      <div className="mt-3 rounded-lg bg-muted/35 px-2.5 py-2">
        <p className="text-[11px] font-black leading-4 text-foreground">السؤال الذي يجيب عنه</p>
        <p className="mt-1 text-[11px] font-medium leading-5 text-muted-foreground">{product.businessQuestion}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1" aria-label="المخرجات المدعومة">
        {product.outputs.map((output) => (
          <span
            key={output}
            className="inline-flex min-h-6 items-center gap-1 rounded-md border border-border/60 bg-background/65 px-1.5 text-[10px] font-bold text-muted-foreground"
          >
            <Check className="size-3 text-primary" aria-hidden="true" />
            {output}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-4">
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 w-full justify-between gap-2 text-xs font-black"
          onClick={openProduct}
          aria-label={`فتح تقرير ${product.title}`}
        >
          <span>فتح التقرير</span>
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}

/**
 * /reports landing authority. It is intentionally a catalog, never a KPI or
 * analytics dashboard. Financial values and charts belong inside the opened
 * report product only.
 */
export function ReportsCatalog() {
  return (
    <section aria-label="كتالوج التقارير" data-reports-premium-catalog>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-4">
        {REPORT_PRODUCTS.map((product) => (
          <ReportCatalogCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
