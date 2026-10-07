/**
 * pdfDocument — the VECTOR PDF emitter.
 *
 * Renders a `UnifiedDocumentModel` with @react-pdf/renderer: real text
 * (selectable, searchable, tiny files), HarfBuzz-shaped Arabic, native
 * pagination with repeated table headers, and native page numbers in the
 * fixed footer band. This is the PDF peer of the HTML print emitter —
 * both consume the same model and tokens; neither is built from the other.
 */
import { createElement as h, type ReactElement } from 'react';
import { Document, Font, Page, Svg, Rect, Line, Text, View } from '@react-pdf/renderer';
import type { DocumentTable, ProfessionalReportBlock, ProfessionalReportGroup, ReportChart, SignatureRole, UnifiedDocumentModel } from '../../types';
import { signatureLabel } from '../documentHtml';
import { isNumericColumn } from '../documentTableHtml';
import { PDF_COLORS as C, PDF_PAGE, PDF_SPACING as S, PDF_TYPE as T, solid } from './pdfTheme';

/* ------------------------------------------------------------------ */
/* Fonts — Tajawal TTFs self-hosted under /fonts (same family the HTML  */
/* emitter uses, so print and PDF share one typographic identity).      */
/* ------------------------------------------------------------------ */

let fontsRegistered = false;
export function registerDocumentPdfFonts(baseUrl = '/fonts/'): void {
  if (fontsRegistered) return;
  Font.register({ family: T.family, src: `${baseUrl}Tajawal-400.ttf` });
  Font.register({ family: T.family, fontWeight: 700, src: `${baseUrl}Tajawal-700.ttf` });
  Font.register({ family: T.family, fontWeight: 900, src: `${baseUrl}Tajawal-900.ttf` });
  fontsRegistered = true;
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                        */
/* ------------------------------------------------------------------ */

type El = ReactElement;

const rtl = { direction: 'rtl', textAlign: 'right' } as const;

/* Explicit per-component line heights. A page-level lineHeight inherits into
   fragmented table rows and corrupts text measurement there (wrapped lines
   reserve phantom line boxes), so every Text opts in on its own. */
const LH_PROSE = 1.5;
const LH_CELL = 1.4;
const LH_TIGHT = 1.3;
const metaLine = (label: string, value: string, ltrValue = false): El =>
  // marginTop: tall Arabic ascenders overflow the line box upward and would
  // clip against the opaque title chip above.
  h(View, { key: label, style: { flexDirection: 'row', gap: 3, justifyContent: 'flex-start', marginTop: 2 } },
    h(Text, { style: { fontSize: T.small, color: C.muted, lineHeight: 1.5, ...rtl } }, `${label}:`),
    h(Text, { style: { fontSize: T.small, color: C.ink, fontWeight: 700, lineHeight: 1.5, ...(ltrValue ? { direction: 'ltr', textAlign: 'left' } : rtl) } }, value));

/* ------------------------------------------------------------------ */
/* Header                                                               */
/* ------------------------------------------------------------------ */

function Header({ model }: { model: UnifiedDocumentModel }): El {
  const hd = model.header;
  return h(View, { style: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 8, marginBottom: 12, borderBottom: 1.6, borderColor: C.ink, borderStyle: 'solid' } },
    h(View, { style: { flexDirection: 'row', gap: 8 } },
      h(View, { style: { width: 40, height: 40, backgroundColor: C.ink, borderRadius: 6, alignItems: 'center', justifyContent: 'center' } },
        h(Text, { style: { color: '#fff', fontSize: 11, fontWeight: 900, lineHeight: 1.4 } }, hd.companyName.trim().slice(0, 5))),
      h(View, null,
        h(Text, { style: { fontSize: T.brand, fontWeight: 900, color: C.accent, lineHeight: LH_TIGHT, ...rtl } }, hd.companyName),
        hd.companyAddress ? h(Text, { style: { fontSize: T.small, color: C.muted, lineHeight: LH_PROSE, ...rtl } }, hd.companyAddress) : null,
        h(View, { style: { flexDirection: 'row', gap: 3 } },
          hd.companyPhone ? h(Text, { key: 'pl', style: { fontSize: T.small, color: C.muted, lineHeight: LH_TIGHT, ...rtl } }, 'الهاتف:') : null,
          hd.companyPhone ? h(Text, { key: 'pv', style: { fontSize: T.small, color: C.muted, lineHeight: LH_TIGHT, direction: 'ltr', textAlign: 'left' } }, hd.companyPhone) : null),
        hd.companyEmail ? h(Text, { style: { fontSize: T.small, color: C.muted, lineHeight: LH_TIGHT, direction: 'ltr', textAlign: 'right' } }, hd.companyEmail) : null,
        hd.companyRegistrationNumber ? h(Text, { style: { fontSize: T.small, color: C.muted, lineHeight: LH_TIGHT, ...rtl } }, `السجل التجاري: ${hd.companyRegistrationNumber}`) : null,
        hd.companyTaxNumber ? h(Text, { style: { fontSize: T.small, color: C.muted, lineHeight: LH_TIGHT, ...rtl } }, `الرقم الضريبي: ${hd.companyTaxNumber}`) : null,
      )),
    h(View, { style: { alignItems: 'flex-end' } },
      h(View, { style: { backgroundColor: C.ink, borderRadius: 5, padding: '5 14' } },
        h(Text, { style: { color: '#fff', fontSize: T.title, fontWeight: 900, lineHeight: 1.5, ...rtl } }, hd.title)),
      hd.documentNo ? metaLine('رقم المستند', hd.documentNo, true) : null,
      hd.dateLabel && hd.dateValue ? metaLine(hd.dateLabel, hd.dateValue) : null,
    ),
  );
}

/* ------------------------------------------------------------------ */
/* KPI strips                                                           */
/* ------------------------------------------------------------------ */

function KpiStrip({ kpis }: { kpis: Array<{ label: string; value: string; comparison?: string | null }> }): El {
  return h(View, { style: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: S.sectionGap } },
    kpis.map((k) =>
      h(View, { key: k.label, style: { flexBasis: '31%', flexGrow: 1, backgroundColor: C.surface, ...solid(0.6, C.border), borderRadius: 5, padding: '6 9' } },
        h(Text, { style: { fontSize: T.caption, color: C.muted, fontWeight: 700, lineHeight: LH_TIGHT, ...rtl } }, k.label),
        h(View, { style: { flexDirection: 'row', gap: 4, alignItems: 'center' } },
          h(Text, { style: { fontSize: T.kpi, fontWeight: 900, color: C.ink, lineHeight: LH_TIGHT, ...rtl } }, k.value),
          k.comparison ? h(Text, { style: { fontSize: T.caption, fontWeight: 700, lineHeight: LH_TIGHT, color: k.comparison.trim().startsWith('-') ? C.risk : C.success } }, k.comparison) : null,
        ))));
}

/* ------------------------------------------------------------------ */
/* Tables                                                               */
/* ------------------------------------------------------------------ */

function Table({ table }: { table: DocumentTable | import('../../types').ReportTable }): El {
  const numeric = table.columns.map((_, i) => isNumericColumn(table.rows, i));
  const totalsRows: string[][] = table.totals
    ? (Array.isArray((table.totals as string[][])[0]) ? (table.totals as string[][]) : [table.totals as string[]])
    : [];
  const cell = (value: string, i: number, kind: 'head' | 'body' | 'foot', rowKey?: string): El =>
    h(Text, {
      key: `${rowKey ?? kind}-${i}`,
      style: {
        width: `${100 / table.columns.length}%`,
        padding: `${S.cellY} ${S.cellX}`,
        fontSize: T.body,
        lineHeight: LH_CELL,
        color: kind === 'head' ? '#fff' : kind === 'foot' ? C.ink : C.ink,
        fontWeight: kind === 'head' || kind === 'foot' || numeric[i] ? 700 : 400,
        ...(numeric[i] ? { textAlign: 'left', direction: 'ltr' } : rtl),
      },
    }, value);

  // NOTE: the page-spanning wrapper must stay BORDERLESS — pdfkit's border
  // clipping math overflows when a bordered node is fragmented across pages.
  // Row rules + the dark head + the totals rule carry the table's edges.
  return h(View, { style: { marginBottom: S.sectionGap } },
    'title' in table && table.title ? h(Text, { style: { fontSize: T.section, fontWeight: 700, lineHeight: LH_TIGHT, color: C.ink, marginBottom: 5, ...rtl } }, table.title) : null,
    h(View, { style: {} },
      h(View, { fixed: true, wrap: false, style: { flexDirection: 'row', backgroundColor: C.ink } }, table.columns.map((c, i) => cell(c, i, 'head'))),
      table.rows.length === 0 && 'emptyNote' in table && table.emptyNote
        ? h(View, { wrap: false, style: { padding: '8 10' } }, h(Text, { style: { fontSize: T.body, color: C.muted, lineHeight: LH_PROSE, ...rtl } }, table.emptyNote))
        // Rows are BORDERLESS (zebra carries separation): bordered nodes
        // fragmented across pages hit pdfkit's clip-math overflow.
        : table.rows.map((row, r) =>
            h(View, { key: r, wrap: false, style: { flexDirection: 'row', backgroundColor: r % 2 === 1 ? C.zebra : '#fff' } },
              row.map((v, i) => cell(v, i, 'body', `r${r}`)))),
      totalsRows.map((trow, t) =>
        h(View, { key: `t${t}`, wrap: false, style: { flexDirection: 'row', backgroundColor: C.total, borderTopWidth: t === 0 ? 1.4 : 0.6, borderTopColor: t === 0 ? C.accent : C.border, borderTopStyle: 'solid' } },
          trow.map((v, i) => {
            const grand = t === totalsRows.length - 1 && i === trow.length - 1;
            return h(Text, {
              key: i,
              style: {
                width: `${100 / table.columns.length}%`,
                padding: `${S.cellY} ${S.cellX}`,
                fontSize: T.body,
                lineHeight: LH_CELL,
                fontWeight: 900,
                color: grand ? C.accent : C.ink,
                ...(numeric[i] || grand ? { textAlign: 'left', direction: 'ltr' } : rtl),
              },
            }, v);
          }))),
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Charts (deterministic SVG)                                           */
/* ------------------------------------------------------------------ */

function Chart({ chart }: { chart: ReportChart }): El {
  const W = 500;
  const H = 150;
  const max = Math.max(1, ...chart.series.flatMap((s) => s.values));
  const n = Math.max(1, chart.categories.length);
  const groupW = W / n;
  const barW = Math.min(26, (groupW * 0.7) / Math.max(1, chart.series.length));

  const bars: El[] = [];
  chart.categories.forEach((_, ci) => {
    chart.series.forEach((s, si) => {
      const v = s.values[ci] ?? 0;
      const bh = Math.round((v / max) * (H - 24));
      const x = ci * groupW + groupW / 2 - (chart.series.length * barW) / 2 + si * barW;
      bars.push(h(Rect, { key: `${ci}-${si}`, x, y: H - 14 - bh, width: barW - 2, height: bh, fill: C.chart[si % C.chart.length] }));
    });
  });

  return h(View, { style: { marginBottom: S.sectionGap, ...solid(0.6, C.border), borderRadius: 6, padding: 10 } },
    h(Text, { style: { fontSize: T.section, fontWeight: 700, lineHeight: LH_TIGHT, ...rtl } }, chart.title),
    chart.caption ? h(Text, { style: { fontSize: T.caption, color: C.muted, lineHeight: LH_PROSE, marginBottom: 4, ...rtl } }, chart.caption) : null,
    h(View, { style: { flexDirection: 'row', gap: 10, marginBottom: 4 } },
      chart.series.map((s, si) =>
        h(View, { key: s.name, style: { flexDirection: 'row', gap: 3, alignItems: 'center' } },
          h(View, { style: { width: 8, height: 8, backgroundColor: C.chart[si % C.chart.length], borderRadius: 2 } }),
          h(Text, { style: { fontSize: T.caption, fontWeight: 700, lineHeight: LH_TIGHT } }, s.name)))),
    h(Svg, { viewBox: `0 0 ${W} ${H}`, style: { width: '100%', height: 130 } },
      h(Line, { x1: 0, y1: H - 14, x2: W, y2: H - 14, stroke: C.border, strokeWidth: 0.8 }),
      ...bars),
    h(View, { style: { flexDirection: 'row' } },
      chart.categories.map((c) =>
        h(Text, { key: c, style: { width: `${100 / n}%`, fontSize: 6.4, lineHeight: LH_TIGHT, color: C.muted, ...rtl, textAlign: 'center' } }, c))),
    chart.note ? h(Text, { style: { fontSize: T.caption, color: C.muted, lineHeight: LH_PROSE, marginTop: 5, ...rtl } }, chart.note) : null,
  );
}

/* ------------------------------------------------------------------ */
/* Notes / identity / professional groups                               */
/* ------------------------------------------------------------------ */

const NOTE_TONE: Record<string, { bg: string; bd: string }> = {
  success: { bg: '#ECFDF5', bd: '#177245' },
  risk: { bg: '#FEF2F2', bd: '#B3261E' },
  info: { bg: '#EFF6FF', bd: '#144EA8' },
  neutral: { bg: C.surface, bd: C.border },
};

function Note({ note }: { note: { text: string; tone: 'info' | 'risk' | 'success' | 'neutral' } }): El {
  const tone = NOTE_TONE[note.tone] ?? NOTE_TONE.neutral;
  return h(View, { style: { backgroundColor: tone.bg, ...solid(0.8, tone.bd), borderRadius: 5, padding: '7 10', marginBottom: S.sectionGap } },
    h(Text, { style: { fontSize: T.body, color: C.ink, lineHeight: LH_PROSE, ...rtl } }, note.text));
}

function ProfessionalBody({ model }: { model: UnifiedDocumentModel }): El[] {
  const body = model.professional!;
  const out: El[] = [
    h(View, { key: 'identity', style: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: S.sectionGap, ...solid(0.6, C.border), borderRadius: 5, padding: 8 } },
      body.identity.map((f) =>
        h(View, { key: f.label, style: { flexBasis: '46%' } },
          h(Text, { style: { fontSize: T.caption, color: C.muted, fontWeight: 700, lineHeight: LH_TIGHT, ...rtl } }, f.label),
          h(Text, { style: { fontSize: T.body, fontWeight: 700, lineHeight: LH_CELL, color: C.ink, ...rtl } }, f.value)))),
  ];
  body.groups.forEach((group: ProfessionalReportGroup, gi) => {
    group.blocks.forEach((block: ProfessionalReportBlock, bi) => {
      const key = `g${gi}b${bi}`;
      if (block.kind === 'kpis') out.push(h(View, { key, wrap: !group.keepTogether }, h(KpiStrip, { kpis: block.kpis })));
      else if (block.kind === 'table') out.push(h(View, { key, wrap: !group.keepTogether }, h(Table, { table: block.table })));
      else if (block.kind === 'chart') out.push(h(View, { key, wrap: !group.keepTogether }, h(Chart, { chart: block.chart })));
      else out.push(h(View, { key, wrap: !group.keepTogether }, h(Note, { note: block.note })));
    });
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Signatures + footer                                                  */
/* ------------------------------------------------------------------ */

function Signatures({ model }: { model: UnifiedDocumentModel }): El {
  const roles: SignatureRole[] = model.footer.signatures;
  if (roles.length === 0 && !model.footer.companyStampLabel) return h(View, { key: 'nosig' });
  return h(View, { style: { flexDirection: 'row', gap: 8, marginTop: 16 } },
    roles.map((role) =>
      h(View, { key: role, style: { flex: 1, minHeight: 56, ...solid(0.7, C.border), borderRadius: 5, padding: 6, alignItems: 'center' } },
        h(Text, { style: { fontSize: T.small, fontWeight: 700, lineHeight: LH_TIGHT } }, signatureLabel[role]),
        h(View, { style: { width: '82%', borderBottomWidth: 0.7, borderBottomColor: C.muted, borderBottomStyle: 'dashed', marginTop: 22 } }),
        h(Text, { style: { fontSize: 6.6, lineHeight: LH_TIGHT, color: C.muted, marginTop: 4 } }, 'التاريخ: ____ / ____ / ____'))),
    model.footer.companyStampLabel
      ? h(View, { style: { flex: 1, minHeight: 56, borderWidth: 1, borderColor: C.accent, borderStyle: 'dashed', borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: C.total } },
          h(Text, { style: { fontSize: T.small, fontWeight: 700, lineHeight: LH_TIGHT, color: C.accent } }, model.footer.companyStampLabel))
      : null);
}

function FooterBand({ name, refText }: { name: string; refText: string }): El {
  return h(View, {
    fixed: true,
    style: { position: 'absolute', bottom: 16, left: 42, right: 42 },
  },
    h(View, { style: { height: 0.6, backgroundColor: C.border, marginBottom: 4 } }),
    h(View, { style: { flexDirection: 'row', justifyContent: 'space-between' } },
    h(Text, { style: { fontSize: T.caption, color: C.muted, ...rtl } }, name),
    h(Text, { style: { fontSize: T.caption, color: C.muted, direction: 'ltr' } }, refText),
    // NOTE: no lineHeight here — inside a `fixed` band any lineHeight makes
    // the whole node vanish (same measurement corruption as table rows).
    h(Text, { style: { fontSize: T.caption, color: C.accent, fontWeight: 700 }, render: ({ pageNumber, totalPages }) => `صفحة ${pageNumber} من ${totalPages}` }),
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Document root                                                        */
/* ------------------------------------------------------------------ */

export function ModelPdfDocument({ model }: { model: UnifiedDocumentModel }): El {
  return h(Document, { title: model.header.title, language: 'ar' },
    // NOTE: no page-level `lineHeight` — inheriting it into table fragments
    // corrupts text measurement (wrapped lines reserve phantom line boxes).
    // Each component sets its own lineHeight instead (see LH_*).
    h(Page, { size: PDF_PAGE.size, style: { padding: PDF_PAGE.padding, fontFamily: T.family, color: C.ink, backgroundColor: '#fff', direction: 'rtl' } },
      h(Header, { model }),
      model.kpis.length > 0 ? h(KpiStrip, { kpis: model.kpis }) : null,
      ...(model.professional ? ProfessionalBody({ model }) : model.tables.map((t, i) => h(Table, { key: `t${i}`, table: t }))),
      h(Signatures, { model }),
      model.footer.metadata ? h(Text, { style: { fontSize: T.caption, color: C.muted, lineHeight: LH_PROSE, marginTop: 10, ...rtl } }, model.footer.metadata) : null,
      h(FooterBand, { name: model.header.companyName, refText: model.header.documentNo ?? '' }),
    ));
}
