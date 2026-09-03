/**
 * ReportPayloadGroup — renders a `ProfessionalReportGroup` from the same
 * canonical owner-report payload used by print/PDF.
 *
 * This is intentionally a pure presentation layer: it walks the payload's
 * kpis/table/chart/note blocks and renders them with existing app
 * primitives. It never computes or re-derives a figure; amount/percent cells
 * are only formatted for screen display with the canonical app formatters.
 * Screen and print therefore read the same authoritative values.
 *
 * Kept intentionally light (plain tables, not EntityTable): these are
 * small, bounded per-group breakdowns (maintenance/expenses/utilities/fees/
 * settlements/reconciliation), not open-ended registers — a heavier
 * paginated/register component would be the wrong tool here and would
 * fight the "compact sections, not one giant table" direction.
 */
import type { ReactNode } from 'react';
import type {
  ProfessionalReportBlock,
  ProfessionalReportGroup,
  ReportCellFormat,
} from '@/services/documents/documentPayloads';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { formatLatinNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';

function renderCell(cell: ReportCellFormat): ReactNode {
  if (cell.kind === 'amount') return <span dir="ltr" className="tabular-nums">{formatMoney(cell.value)}</span>;
  if (cell.kind === 'percent') return <span dir="ltr" className="tabular-nums">{formatLatinNumber(cell.value, 'ar')}٪</span>;
  return <span>{cell.value}</span>;
}

function ReportGroupKpis({ kpis }: Readonly<{ kpis: Extract<ProfessionalReportBlock, { kind: 'kpis' }>['kpis'] }>) {
  if (kpis.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <p className="text-[11px] font-bold leading-4 text-muted-foreground">{kpi.label}</p>
          <p className="mt-1 text-sm font-black leading-5">{renderCell(kpi.value)}</p>
          {kpi.comparison ? (
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{renderCell(kpi.comparison)}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ReportGroupTable({ table }: Readonly<{ table: Extract<ProfessionalReportBlock, { kind: 'table' }>['table'] }>) {
  const hasRows = table.rows.length > 0;
  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      {table.title ? (
        <div className="border-b border-border/60 bg-muted/30 px-3 py-2">
          <p className="text-xs font-black">{table.title}</p>
        </div>
      ) : null}
      {hasRows ? (
        <div className="mobile-scroll-x overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-full border-collapse text-[12.5px] leading-5">
            <caption className="sr-only">{table.title ?? 'تفاصيل التقرير'}</caption>
            <thead>
              <tr className="border-b border-border/55 bg-muted/10">
                {table.columns.map((column) => (
                  <th key={column} scope="col" className="whitespace-nowrap px-3 py-2 text-start text-[11px] font-semibold text-muted-foreground">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border/40 last:border-b-0 even:bg-muted/10">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 align-top">{renderCell(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            {table.totals ? (
              <tfoot>
                <tr className="border-t-2 border-border/70 bg-muted/25 font-extrabold">
                  {table.totals.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2">{renderCell(cell)}</td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : (
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">{table.emptyNote ?? 'لا توجد بيانات لهذا القسم.'}</p>
      )}
    </div>
  );
}

function ReportGroupNote({ note }: Readonly<{ note: Extract<ProfessionalReportBlock, { kind: 'note' }>['note'] }>) {
  return (
    <p
      className={cn(
        'rounded-xl border px-3 py-2 text-[11.5px] leading-5',
        note.tone === 'risk' && 'border-danger/25 bg-danger/[0.06] text-danger',
        note.tone === 'success' && 'border-success/25 bg-success/[0.06] text-success',
        note.tone === 'info' && 'border-primary/20 bg-primary/[0.05] text-primary',
        note.tone === 'neutral' && 'border-border/60 bg-muted/20 text-muted-foreground',
      )}
    >
      {note.text}
    </p>
  );
}

/**
 * Charts are print/PDF-only for now — the professional-owner-report
 * payload only carries deterministic print charts, and no owner-statement
 * group currently emits a `chart` block. Rendered defensively (a labelled
 * fallback, not a crash) if one is ever added, so this stays a pure
 * pass-through renderer rather than a place that grows chart logic.
 */
function ReportGroupChart({ chart }: Readonly<{ chart: Extract<ProfessionalReportBlock, { kind: 'chart' }>['chart'] }>) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
      {chart.title} — الرسم البياني متاح ضمن نسخة الطباعة/PDF.
    </div>
  );
}

function ReportGroupBlock({ block }: Readonly<{ block: ProfessionalReportBlock }>) {
  if (block.kind === 'kpis') return <ReportGroupKpis kpis={block.kpis} />;
  if (block.kind === 'table') return <ReportGroupTable table={block.table} />;
  if (block.kind === 'chart') return <ReportGroupChart chart={block.chart} />;
  return <ReportGroupNote note={block.note} />;
}

export function ReportPayloadGroup({ group }: Readonly<{ group: ProfessionalReportGroup }>) {
  return (
    <div className="space-y-2.5">
      {group.blocks.map((block, index) => (
        <ReportGroupBlock key={index} block={block} />
      ))}
    </div>
  );
}
