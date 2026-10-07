/**
 * pdfTheme — design tokens for the VECTOR PDF emitter, in PDF points.
 *
 * Single source of truth stays `documentDesignTokens`; this module merely
 * expresses the same decisions in the units/idiom of @react-pdf/renderer
 * (pt, longhand borders — the shorthand parser requires the style word).
 */
import { DOCUMENT_COLORS, DOCUMENT_PAGE } from '../../documentDesignTokens';

export const PDF_COLORS = {
  ink: DOCUMENT_COLORS.ink,
  accent: DOCUMENT_COLORS.accent,
  muted: DOCUMENT_COLORS.muted,
  border: DOCUMENT_COLORS.border,
  surface: DOCUMENT_COLORS.surface,
  zebra: '#F8FAFC',
  total: '#EAF4FB',
  page: DOCUMENT_COLORS.page,
  success: '#177245',
  risk: '#B3261E',
  info: '#144EA8',
  chart: DOCUMENT_COLORS.chartPalette,
} as const;

/** A4 with printable margins; extra bottom room hosts the fixed footer band. */
export const PDF_PAGE = {
  size: 'A4' as const,
  padding: '38 42 56 42',
  contentWidthPt: Math.round((DOCUMENT_PAGE.widthMm / 25.4) * 72) - 84,
} as const;

export const PDF_TYPE = {
  family: 'Tajawal',
  body: 9,
  small: 7.5,
  caption: 7,
  section: 10.5,
  brand: 14,
  title: 12,
  kpi: 10.5,
  lineHeight: 1.55,
} as const;

export const PDF_SPACING = {
  sectionGap: 12,
  blockGap: 8,
  cellY: 4.5,
  cellX: 7,
} as const;

export const solid = (width: number, color: string) =>
  ({ borderWidth: width, borderStyle: 'solid', borderColor: color }) as const;
