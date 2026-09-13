/**
 * MALEK document design tokens — the ONE source of truth for the visual
 * and geometric contract of every printed/exported document.
 *
 * Every renderer artifact (offscreen PDF blocks, the print popup
 * stylesheet, page shells, table primitives, page footers) consumes these
 * tokens. A document may not invent its own page geometry, colors, type
 * scale, or spacing — changing a value here changes the whole document
 * platform consistently.
 *
 * Derivation notes:
 *  - Colors extend the application's slate/royal system (`styles/tokens.css`)
 *    with print-optimized contrast: ink text on white, ONE restrained brand
 *    accent, never decorative fills that waste toner or hide content.
 *  - A4 portrait is the fixed page model for every template (the registry
 *    `PagePolicy` and the renderer page shells both reference
 *    `DOCUMENT_PAGE`); the target markets (Oman/GCC) standardize on A4.
 *  - The type scale is tuned for A4 density: 12px body keeps statements
 *    professional and page-efficient without ever dropping below readable
 *    sizes; no document text may be rendered smaller than `caption`.
 */

/* ------------------------------------------------------------------ */
/* Page geometry                                                       */
/* ------------------------------------------------------------------ */

export const DOCUMENT_PAGE = {
  /** ISO A4 portrait — the only page model the platform prints. */
  widthMm: 210,
  heightMm: 297,
  /**
   * Printable-area margins. The print popup's `@page` rule, the offscreen
   * PDF page shells, and the registry page policy all use these exact
   * values, so browser print and generated PDF paginate identically.
   */
  marginsMm: { top: 12, right: 10, bottom: 15, left: 10 },
  /**
   * Reserved band inside the bottom margin for the per-page footer
   * (company / reference / page number). Content never extends into it.
   */
  pageFooterBandMm: 9,
} as const;

/* ------------------------------------------------------------------ */
/* Colors — restrained, print-safe                                     */
/* ------------------------------------------------------------------ */

export const DOCUMENT_COLORS = {
  /** Page background — always white on paper. */
  page: '#FFFFFF',
  /** Primary text (headings, strong values). */
  ink: '#0F172A',
  /** Body text. */
  text: '#1E293B',
  /** Strong supporting text (note labels, chart value labels). */
  strong: '#334155',
  /** Secondary captions (comparisons, series names). */
  secondary: '#475569',
  /** Secondary / supporting text. */
  muted: '#64748B',
  /** Faint separators and placeholder marks. */
  subtle: '#94A3B8',
  /** The single brand accent (section rules, totals, emphasis). */
  accent: '#0284C7',
  /** Soft accent surface (stamp box, accent chips). */
  accentSoft: '#F0F9FF',
  /** Card/strip surfaces. */
  surface: '#F8FAFC',
  surfaceAlt: '#F1F5F9',
  /** Hairline borders. */
  border: '#E2E8F0',
  /** Table grid borders (one step darker for print legibility). */
  tableBorder: '#CBD5E1',
  /** Table header band — ink on white text. */
  tableHeadBg: '#0F172A',
  tableHeadFg: '#FFFFFF',
  /** Note tones (background/border pairs; labels carry the meaning). */
  noteInfo: { bg: '#EFF6FF', border: '#93C5FD' },
  noteRisk: { bg: '#FEF2F2', border: '#FCA5A5' },
  noteSuccess: { bg: '#F0FDF4', border: '#86EFAC' },
  noteNeutral: { bg: '#F8FAFC', border: '#CBD5E1' },
  /** Deterministic chart palette (print-safe, colorblind-considerate order). */
  chartPalette: ['#0284C7', '#F59E0B', '#94A3B8', '#0F766E', '#7C3AED', '#DC2626', '#64748B'],
} as const;

/* ------------------------------------------------------------------ */
/* Typography — one hierarchy for every document                       */
/* ------------------------------------------------------------------ */

export const DOCUMENT_TYPE = {
  /** Company brand line in the document header. */
  companyBrand: 'font-size: 20px; font-weight: 900',
  /** Document title badge. */
  docTitle: 'font-size: 18px; font-weight: 800',
  /** Section heading (table titles, signature heading). */
  sectionTitle: 'font-size: 14px; font-weight: 800',
  /** Body copy. */
  body: 'font-size: 12px',
  /** Table header cells. */
  tableHead: 'font-size: 12px; font-weight: 700',
  /** Table body cells. */
  tableCell: 'font-size: 12px',
  /** Totals figures. */
  totals: 'font-size: 12px; font-weight: 800',
  /** KPI labels / metadata lines. */
  meta: 'font-size: 11px; font-weight: 700',
  /** KPI values. */
  kpiValue: 'font-size: 15px; font-weight: 900',
  /** Captions, footnotes, page footer band. */
  caption: 'font-size: 10px',
  pageFooter: 'font-size: 9px',
  /** Shared rhythm for all document text. */
  lineHeight: '1.6',
  /** The Arabic-first font stack used by every rendered artifact. */
  fontFamily: '"Cairo", "Segoe UI", Tahoma, sans-serif',
} as const;

/* ------------------------------------------------------------------ */
/* Spacing — consistent rhythm between document blocks                 */
/* ------------------------------------------------------------------ */

export const DOCUMENT_SPACING = {
  /** Gap between top-level document blocks (header/KPIs/tables/notes). */
  sectionGapMm: 18,
  /** Tighter gap between continuation chunks of one logical table. */
  tableChunkGapMm: 10,
  /** Space under a section title before its content. */
  titleGapMm: 8,
  /** Vertical signature-block separation from the body. */
  signatureGapMm: 30,
} as const;

/* ------------------------------------------------------------------ */
/* Tables — one shared table contract                                  */
/* ------------------------------------------------------------------ */

export const DOCUMENT_TABLE = {
  /** Cell padding keeps A4 statements dense yet readable. */
  cellPadding: '4px 8px',
  headPadding: '6px',
  border: `1px solid ${DOCUMENT_COLORS.tableBorder}`,
  headBorder: `1px solid ${DOCUMENT_COLORS.tableHeadBg}`,
  /**
   * Maximum rows per static table chunk. The paginator additionally
   * measures real heights and splits any chunk that still exceeds a page,
   * so this cap is a coarse upper bound, not the pagination mechanism.
   */
  maxRowsPerChunk: 22,
} as const;
