/**
 * Professional report document composition — the ONLY renderer for the
 * `owner_report` / `property_report` document bodies.
 *
 * Document language (shared visual layer for MALEK professional reports):
 *  - identity strip under the header,
 *  - executive KPI strips with optional period-change chips,
 *  - compact A4-density tables,
 *  - deterministic inline-SVG charts (no hover-only info, no animation,
 *    RTL label layout, print-safe contrast),
 *  - insight / risk notes,
 *  - `keepTogether` groups rendered as ONE atomic block so the paginator
 *    can only move them wholesale.
 *
 * Everything is fully inline-styled (the offscreen PDF container receives
 * these fragments without any stylesheet; the print popup only adds page
 * rules). Every section carries `class="document-block"` so the block
 * paginator treats it as an atomic page unit: a table, chart or
 * keep-together group can never be clipped mid-way.
 *
 * Long tables are chunked into page-sized table blocks up-front (the same
 * contract as `chunkTableBlocks` in `documentHtml.ts`): each chunk repeats
 * its column header, totals stay on the last chunk, and the paginator only
 * breaks BETWEEN chunks. Report adapters are responsible for producing
 * logical (business-meaningful) groups so ordinary reports never need a
 * chunk boundary at all.
 */
import type { ProfessionalReportBody, ReportChart, ReportKpi, ReportNote, ReportTable } from '../types';
import { MAX_ROWS_PER_TABLE_CHUNK } from '../documentRegistry';
import { escapeDocumentHtml } from './documentHtmlShared';
import { formatLatinNumber } from '@/lib/formatters';

/* ------------------------------------------------------------------ */
/* Shared layout constants                                             */
/* ------------------------------------------------------------------ */

const BLOCK_CLASS = 'document-block';
const SECTION_WRAP = 'margin-bottom: 22px; page-break-inside: avoid; break-inside: avoid;';
const COMPACT_SECTION_WRAP = 'margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid;';
const TABLE_HEAD_BG = '#0F172A';
const TABLE_HEAD_FG = '#FFFFFF';
const TABLE_BORDER = '#CBD5E1';
const TABLE_TEXT = '#1E293B';
const ACCENT = '#0284C7';

const CHART_COLORS = ['#0284C7', '#F59E0B', '#94A3B8', '#0F766E', '#7C3AED', '#DC2626', '#64748B'];

/* ------------------------------------------------------------------ */
/* Numeric helpers (chart labels only — financial cells are formatted   */
/* by the engine builder with company currency precision).             */
/* ------------------------------------------------------------------ */

const chartNumber = (value: number): string =>
  formatLatinNumber(value, 'ar-OM', { maximumFractionDigits: 0 });

/** Rows are displayed RTL: the first category sits at the RIGHT edge. */
const reversed = <T,>(values: readonly T[]): T[] => [...values].reverse();

const chartMax = (chart: ReportChart): number => {
  let max = 0;
  for (const series of chart.series) {
    for (const value of series.values) {
      if (Number.isFinite(value) && Math.abs(value) > max) max = Math.abs(value);
    }
  }
  return max;
};

const chartTotal = (chart: ReportChart, seriesIndex: number): number =>
  chart.series[seriesIndex]?.values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0) ?? 0;

/** Nice ceiling: round up to a "readable" axis max (multiples of 5 units). */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

/* ------------------------------------------------------------------ */
/* Identity strip                                                      */
/* ------------------------------------------------------------------ */

function buildIdentityBlock(body: ProfessionalReportBody): string {
  if (body.identity.length === 0) return '';
  const cells = body.identity
    .map(
      (row) => `
      <div style="border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px 12px; background: #F8FAFC;">
        <span style="display: block; font-size: 10px; font-weight: 700; color: #64748B; margin-bottom: 2px;">${escapeDocumentHtml(row.label)}</span>
        <span style="display: block; font-size: 13px; font-weight: 800; color: #0F172A;">${escapeDocumentHtml(row.value)}</span>
      </div>`,
    )
    .join('');
  return `<section class="${BLOCK_CLASS}" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; ${SECTION_WRAP}">${cells}</section>`;
}

/* ------------------------------------------------------------------ */
/* KPI strip with period-change chips                                  */
/* ------------------------------------------------------------------ */

function buildKpiStripBlock(kpis: ReportKpi[]): string {
  if (kpis.length === 0) return '';
  const chips = kpis
    .map((kpi) => {
      const comparison =
        kpi.comparison != null
          ? `<span style="display: block; font-size: 10px; font-weight: 700; margin-top: 4px; color: #475569; border-top: 1px dashed #CBD5E1; padding-top: 4px;">التغير: <strong>${escapeDocumentHtml(kpi.comparison)}</strong></span>`
          : '';
      return `
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 14px; page-break-inside: avoid; break-inside: avoid;">
        <span style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">${escapeDocumentHtml(kpi.label)}</span>
        <span style="display: block; font-size: 16px; font-weight: 900; color: #0F172A;">${escapeDocumentHtml(kpi.value)}</span>
        ${comparison}
      </div>`;
    })
    .join('');
  return `<section class="${BLOCK_CLASS}" style="background-color: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 12px; padding: 12px; ${SECTION_WRAP}"><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">${chips}</div></section>`;
}

/* ------------------------------------------------------------------ */
/* Compact print table                                                 */
/* ------------------------------------------------------------------ */

const NUMERIC_CELL_REGEX = /^[\s\-+]*[\d,.]+(?:\s?(?:ر\.?ع\.?|OMR|SAR|AED|USD|%))?\s*$/;

const isNumericCell = (value: string): boolean => NUMERIC_CELL_REGEX.test(value.trim());

const compactCellAlignment = (rows: string[][], columnIndex: number): string => {
  const values = rows.map((row) => row[columnIndex]).filter((value): value is string => Boolean(value?.trim()));
  const numeric = values.length > 0 && values.every((value) => isNumericCell(value));
  return numeric ? 'font-weight: 700; text-align: left;' : 'text-align: right;';
};

const compactRowsHtml = (rows: string[][]): string =>
  rows
    .map(
      (row) =>
        `<tr style="page-break-inside: avoid; break-inside: avoid;">${row
          .map(
            (cell, index) =>
              `<td style="border: 1px solid ${TABLE_BORDER}; padding: 6px 8px; font-size: 12px; color: ${TABLE_TEXT}; ${compactCellAlignment(rows, index)}">${escapeDocumentHtml(cell)}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');

const compactHeadHtml = (columns: string[], rows: string[][]): string =>
  `<thead><tr>${columns
    .map(
      (column, index) =>
        `<th style="background-color: ${TABLE_HEAD_BG}; color: ${TABLE_HEAD_FG}; font-weight: 700; font-size: 12px; padding: 8px; border: 1px solid ${TABLE_HEAD_BG}; text-align: ${
          compactCellAlignment(rows, index) === 'font-weight: 700; text-align: left;' ? 'left' : 'right'
        };">${escapeDocumentHtml(column)}</th>`,
    )
    .join('')}</tr></thead>`;

const compactFootHtml = (totals: string[]): string =>
  totals.length
    ? `<tfoot><tr style="background-color: #F8FAFC; font-weight: 800;">${totals
        .map(
          (total, index) =>
            `<th style="border: 1px solid ${TABLE_BORDER}; padding: 8px; font-size: 12px; color: ${ACCENT}; text-align: ${
              index === totals.length - 1 ? 'left' : 'right'
            };">${escapeDocumentHtml(total)}</th>`,
        )
        .join('')}</tr></tfoot>`
    : '';

const compactEmptyNote = (note: string, columnCount: number): string =>
  `<tr><td colspan="${Math.max(1, columnCount)}" style="border: 1px solid ${TABLE_BORDER}; padding: 10px; font-size: 11px; color: #64748B; text-align: center;">${escapeDocumentHtml(note)}</td></tr>`;

/**
 * Compact tables render in page-sized chunks (each chunk = one atomic
 * block). This protects pathological >1-page tables; normal report groups
 * are one chunk and therefore one atomic block. Headers repeat per chunk,
 * totals only on the final chunk, and the title never orphans from the
 * table because title + first chunk share one block.
 */
function buildCompactTableBlocks(table: ReportTable): string[] {
  const chunks: string[][][] = [];
  for (let index = 0; index < table.rows.length; index += MAX_ROWS_PER_TABLE_CHUNK) {
    chunks.push(table.rows.slice(index, index + MAX_ROWS_PER_TABLE_CHUNK));
  }
  if (chunks.length === 0) chunks.push([]);

  return chunks.map((chunkRows, chunkIndex) => {
    const isFirst = chunkIndex === 0;
    const isLast = chunkIndex === chunks.length - 1;
    const body = chunkRows.length === 0 && table.emptyNote
      ? compactEmptyNote(table.emptyNote, table.columns.length)
      : compactRowsHtml(chunkRows);
    const titleHtml = isFirst && table.title
      ? `<h3 style="font-size: 14px; font-weight: 800; color: #0F172A; margin: 0 0 8px 0; border-right: 3px solid ${ACCENT}; padding-right: 8px;">${escapeDocumentHtml(table.title)}</h3>`
      : '';
    const html = `
      <table style="width: 100%; border-collapse: collapse;">
        ${compactHeadHtml(table.columns, table.rows)}
        <tbody>${body}</tbody>
        ${isLast ? compactFootHtml(table.totals ?? []) : ''}
      </table>`;
    return `<section class="${BLOCK_CLASS}" style="${isFirst ? COMPACT_SECTION_WRAP : 'margin-bottom: 10px; page-break-inside: avoid; break-inside: avoid;'}">${titleHtml}${html}</section>`;
  });
}

/* ------------------------------------------------------------------ */
/* Insight / risk note                                                 */
/* ------------------------------------------------------------------ */

const NOTE_TONES: Record<ReportNote['tone'], { bg: string; border: string; label: string }> = {
  info: { bg: '#EFF6FF', border: '#93C5FD', label: 'ملاحظة' },
  risk: { bg: '#FEF2F2', border: '#FCA5A5', label: 'مؤشر خطر' },
  success: { bg: '#F0FDF4', border: '#86EFAC', label: 'مؤشر إيجابي' },
  neutral: { bg: '#F8FAFC', border: '#CBD5E1', label: 'بيان' },
};

function buildNoteBlock(note: ReportNote): string {
  const tone = NOTE_TONES[note.tone] ?? NOTE_TONES.neutral;
  return `<section class="${BLOCK_CLASS}" style="background: ${tone.bg}; border: 1px solid ${tone.border}; border-radius: 10px; padding: 10px 14px; ${SECTION_WRAP}">
    <span style="display: block; font-size: 11px; font-weight: 800; color: #334155; margin-bottom: 4px;">${tone.label}</span>
    <span style="display: block; font-size: 12px; font-weight: 600; color: #1E293B;">${escapeDocumentHtml(note.text)}</span>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* Deterministic print-safe SVG charts                                 */
/* ------------------------------------------------------------------ */

const SVG_WIDTH = 700;
const SVG_PLOT_LEFT = 20;
const SVG_PLOT_RIGHT = 20;
const SVG_LEGEND_Y = 3;
const SVG_AXIS_Y = 236;
const SVG_CHART_BOTTOM = 236;
const SVG_TOP_PAD = 30;
const SVG_TEXT_COLOR = '#334155';

function buildLegendHtml(chart: ReportChart): string {
  if (chart.series.length <= 1) return '';
  return `<div style="display: flex; flex-wrap: wrap; gap: 10px 18px; margin: 6px 0 2px 0;">${chart.series
    .map(
      (series, index) =>
        `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: ${SVG_TEXT_COLOR};">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: ${CHART_COLORS[index % CHART_COLORS.length]};"></span>
          ${escapeDocumentHtml(series.name)}
        </span>`,
    )
    .join('')}</div>`;
}

function buildChartTitle(chart: ReportChart): string {
  return `<h3 style="font-size: 14px; font-weight: 800; color: #0F172A; margin: 0 0 2px 0; border-right: 3px solid ${ACCENT}; padding-right: 8px;">${escapeDocumentHtml(chart.title)}</h3>${
    chart.caption ? `<div style="font-size: 11px; color: #64748B; margin: 2px 0 4px 0;">${escapeDocumentHtml(chart.caption)}</div>` : ''
  }`;
}

function buildChartSvg(chart: ReportChart): string {
  const max = chartMax(chart);
  const yMax = niceMax(max);

  let svg = '';
  if (chart.chartType === 'hbar') {
    svg = buildHBarSvg(chart, yMax);
  } else if (chart.chartType === 'stacked-bars') {
    svg = buildStackedBarSvg(chart);
  } else {
    svg = buildGroupedBarSvg(chart, yMax);
  }

  const note = chart.note
    ? `<div style="font-size: 10px; color: #64748B; margin-top: 4px; border-top: 1px dashed #CBD5E1; padding-top: 4px;">${escapeDocumentHtml(chart.note)}</div>`
    : '';
  return `<section class="${BLOCK_CLASS}" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 12px 14px; ${SECTION_WRAP}">
    ${buildChartTitle(chart)}
    ${buildLegendHtml(chart)}
    ${svg}
    ${note}
  </section>`;
}

/** Grouped vertical bars, categories laid right→left (oldest at right). */
function buildGroupedBarSvg(chart: ReportChart, yMax: number): string {
  const categories = reversed(chart.categories);
  const seriesValues = chart.series.map((series) => reversed(series.values));
  const seriesCount = Math.max(1, chart.series.length);
  const categoryCount = Math.max(1, categories.length);
  const plotWidth = SVG_WIDTH - SVG_PLOT_LEFT - SVG_PLOT_RIGHT;
  const plotHeight = SVG_CHART_BOTTOM - SVG_TOP_PAD;
  const groupWidth = plotWidth / categoryCount;
  const barWidth = Math.min(26, Math.max(6, (groupWidth * 0.72) / seriesCount));
  const scale = plotHeight / yMax;

  let bars = '';
  let labels = '';
  for (let c = 0; c < categoryCount; c += 1) {
    const groupX = SVG_PLOT_LEFT + c * groupWidth;
    const labelX = groupX + groupWidth / 2;
    labels += `<text x="${labelX}" y="${SVG_AXIS_Y + 16}" font-size="10" font-weight="700" fill="${SVG_TEXT_COLOR}" text-anchor="middle">${escapeDocumentHtml(categories[c])}</text>`;
    const totalBarSpace = barWidth * seriesCount + (seriesCount - 1) * 4;
    const startX = groupX + (groupWidth - totalBarSpace) / 2;
    for (let s = 0; s < seriesCount; s += 1) {
      const raw = seriesValues[s][c] ?? 0;
      const value = Number.isFinite(raw) ? raw : 0;
      const barHeight = Math.max(1, value * scale);
      const barX = startX + s * (barWidth + 4);
      const barY = SVG_AXIS_Y - barHeight;
      const color = CHART_COLORS[s % CHART_COLORS.length];
      bars += `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="2" fill="${color}" />`;
      if (value !== 0) {
        bars += `<text x="${barX + barWidth / 2}" y="${barY - 4}" font-size="9" font-weight="700" fill="#0F172A" text-anchor="middle">${chartNumber(value)}</text>`;
      }
    }
  }

  let axis = '';
  for (let step = 0; step <= 4; step += 1) {
    const y = SVG_AXIS_Y - (plotHeight * step) / 4;
    const tickValue = (yMax * step) / 4;
    axis += `<line x1="${SVG_PLOT_LEFT}" x2="${SVG_WIDTH - SVG_PLOT_RIGHT}" y1="${y}" y2="${y}" stroke="#E2E8F0" stroke-width="1" />`;
    axis += `<text x="${SVG_PLOT_LEFT - 6}" y="${y + 3}" font-size="9" fill="#64748B" text-anchor="end">${chartNumber(tickValue)}</text>`;
  }

  const height = SVG_CHART_BOTTOM + 26;
  return `<svg viewBox="0 0 ${SVG_WIDTH} ${height}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeDocumentHtml(chart.title)}">${axis}${bars}<line x1="${SVG_PLOT_LEFT}" x2="${SVG_WIDTH - SVG_PLOT_RIGHT}" y1="${SVG_AXIS_Y}" y2="${SVG_AXIS_Y}" stroke="#94A3B8" stroke-width="1.5" />${labels}</svg>`;
}

/** Horizontal bars (RTL: labels on the right, bars grow leftwards). */
function buildHBarSvg(chart: ReportChart, yMax: number): string {
  const series = chart.series[0];
  const values = series?.values ?? [];
  const categories = chart.categories;
  const seriesName = series?.name;
  const rowCount = Math.max(1, categories.length);
  const labelWidth = 150;
  const plotWidth = SVG_WIDTH - SVG_PLOT_LEFT - SVG_PLOT_RIGHT - labelWidth;
  const rowHeight = Math.min(30, Math.max(14, 220 / rowCount));
  const barHeight = Math.max(6, rowHeight * 0.62);
  const plotHeight = rowCount * rowHeight;
  const scale = plotHeight / yMax;
  const total = chartTotal(chart, 0);
  const chartBottom = 40 + plotHeight;

  let rows = '';
  for (let index = 0; index < rowCount; index += 1) {
    const y = 34 + index * rowHeight;
    const value = Number.isFinite(values[index]) ? values[index] : 0;
    const width = Math.max(value === 0 ? 1 : 2, value * scale);
    const share = total > 0 ? (value / total) * 100 : 0;
    // Label column on the RIGHT (RTL document order).
    rows += `<text x="${labelWidth - 8}" y="${y + rowHeight / 2 + 3}" font-size="11" font-weight="700" fill="${SVG_TEXT_COLOR}" text-anchor="end">${escapeDocumentHtml(categories[index] ?? '')}</text>`;
    rows += `<rect x="${labelWidth - width}" y="${y + (rowHeight - barHeight) / 2}" width="${width}" height="${barHeight}" rx="2" fill="${CHART_COLORS[index % CHART_COLORS.length]}" />`;
    rows += `<text x="${labelWidth - width - 6}" y="${y + rowHeight / 2 + 3}" font-size="10" font-weight="700" fill="#0F172A" text-anchor="end">${chartNumber(value)}</text>`;
    rows += `<text x="${labelWidth + 6}" y="${y + rowHeight / 2 + 3}" font-size="9" fill="#64748B">${chartNumber(share)}%</text>`;
  }

  const title = seriesName
    ? `<div style="font-size: 10px; font-weight: 700; color: #475569; margin-bottom: 6px;">${escapeDocumentHtml(seriesName)}</div>`
    : '';
  const height = chartBottom + 8;
  return `<div>${title}<svg viewBox="0 0 ${SVG_WIDTH} ${height}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeDocumentHtml(chart.title)}">${rows}</svg></div>`;
}

/** Stacked bars (occupied vs vacant per category), categories right→left. */
function buildStackedBarSvg(chart: ReportChart): string {
  const categories = reversed(chart.categories);
  const seriesValues = chart.series.map((s) => reversed(s.values));
  const categoryCount = Math.max(1, categories.length);
  const plotWidth = SVG_WIDTH - SVG_PLOT_LEFT - SVG_PLOT_RIGHT;
  const plotHeight = SVG_AXIS_Y - SVG_TOP_PAD;
  const groupWidth = plotWidth / categoryCount;
  const barWidth = Math.min(34, Math.max(10, groupWidth * 0.5));

  // Absolute stacked heights — compute per-column total for the y scale.
  let columnMax = 0;
  for (let c = 0; c < categoryCount; c += 1) {
    const columnTotal = chart.series.reduce((sum, _, s) => sum + Number(seriesValues[s][c] ?? 0), 0);
    if (columnTotal > columnMax) columnMax = columnTotal;
  }
  const yMax = niceMax(columnMax);
  const scale = plotHeight / yMax;

  let bars = '';
  let labels = '';
  for (let c = 0; c < categoryCount; c += 1) {
    const groupX = SVG_PLOT_LEFT + c * groupWidth;
    const labelX = groupX + groupWidth / 2;
    labels += `<text x="${labelX}" y="${SVG_AXIS_Y + 16}" font-size="10" font-weight="700" fill="${SVG_TEXT_COLOR}" text-anchor="middle">${escapeDocumentHtml(categories[c])}</text>`;
    const barX = groupX + (groupWidth - barWidth) / 2;
    let y = SVG_AXIS_Y;
    let columnTotal = 0;
    for (let s = 0; s < chart.series.length; s += 1) {
      const raw = seriesValues[s][c] ?? 0;
      const value = Number.isFinite(raw) ? Math.max(0, raw) : 0;
      if (value <= 0) continue;
      const barHeight = value * scale;
      columnTotal += value;
      y -= barHeight;
      bars += `<rect x="${barX}" y="${y}" width="${barWidth}" height="${Math.max(1, barHeight)}" fill="${CHART_COLORS[s % CHART_COLORS.length]}" />`;
    }
    if (columnTotal > 0) {
      bars += `<text x="${barX + barWidth / 2}" y="${y - 4}" font-size="9" font-weight="700" fill="#0F172A" text-anchor="middle">${chartNumber(columnTotal)}</text>`;
    }
  }

  let axis = '';
  for (let step = 0; step <= 4; step += 1) {
    const y = SVG_AXIS_Y - (plotHeight * step) / 4;
    axis += `<line x1="${SVG_PLOT_LEFT}" x2="${SVG_WIDTH - SVG_PLOT_RIGHT}" y1="${y}" y2="${y}" stroke="#E2E8F0" stroke-width="1" />`;
    axis += `<text x="${SVG_PLOT_LEFT - 6}" y="${y + 3}" font-size="9" fill="#64748B" text-anchor="end">${chartNumber((yMax * step) / 4)}</text>`;
  }

  const height = SVG_CHART_BOTTOM + 26;
  return `<svg viewBox="0 0 ${SVG_WIDTH} ${height}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeDocumentHtml(chart.title)}">${axis}${bars}<line x1="${SVG_PLOT_LEFT}" x2="${SVG_WIDTH - SVG_PLOT_RIGHT}" y1="${SVG_AXIS_Y}" y2="${SVG_AXIS_Y}" stroke="#94A3B8" stroke-width="1.5" />${labels}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Body composition                                                    */
/* ------------------------------------------------------------------ */

function buildBlockHtml(block: ProfessionalReportBody['groups'][number]['blocks'][number]): string[] {
  switch (block.kind) {
    case 'kpis': {
      const html = buildKpiStripBlock(block.kpis);
      return html ? [html] : [];
    }
    case 'table':
      return buildCompactTableBlocks(block.table);
    case 'chart':
      return [buildChartSvg(block.chart)];
    case 'note':
      return [buildNoteBlock(block.note)];
  }
}

/**
 * Flat, page-friendly block sequence for professional report bodies.
 * `keepTogether` groups render as a SINGLE atomic section (inner blocks
 * still render their own internal layout); regular groups contribute one
 * atomic block per inner block. The result plugs straight into the same
 * paginator as every other document, so no-split tables and whole-chart
 * blocks are enforced identically for print and PDF.
 */
export function buildProfessionalDocumentBlocks(body: ProfessionalReportBody): string[] {
  const blocks: string[] = [];
  const identity = buildIdentityBlock(body);
  if (identity) blocks.push(identity);

  for (const group of body.groups) {
    if (group.keepTogether) {
      const inner = group.blocks.flatMap((block) => buildBlockHtml(block));
      blocks.push(`<section class="${BLOCK_CLASS}" style="${SECTION_WRAP}">${inner.join('')}</section>`);
    } else {
      blocks.push(...group.blocks.flatMap((block) => buildBlockHtml(block)));
    }
  }
  return blocks;
}

/** Text chunks for Arabic/print detection (parity with other documents). */
export function collectProfessionalTextChunks(body: ProfessionalReportBody): string[] {
  const chunks: string[] = [...body.identity.flatMap((row) => [row.label, row.value])];
  for (const group of body.groups) {
    for (const block of group.blocks) {
      switch (block.kind) {
        case 'kpis':
          for (const kpi of block.kpis) {
            chunks.push(kpi.label, kpi.value, kpi.comparison ?? '');
          }
          break;
        case 'table':
          chunks.push(
            block.table.title ?? '',
            ...block.table.columns,
            ...block.table.rows.flat(),
            ...(block.table.totals ?? []),
            block.table.emptyNote ?? '',
          );
          break;
        case 'chart':
          chunks.push(block.chart.title, block.chart.caption ?? '', ...block.chart.series.map((s) => s.name), block.chart.note ?? '');
          break;
        case 'note':
          chunks.push(block.note.text);
          break;
      }
    }
  }
  return chunks.filter((chunk): chunk is string => Boolean(chunk));
}