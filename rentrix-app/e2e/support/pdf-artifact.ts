/**
 * Real PDF artifact inspection for the PR 3 acceptance suite.
 *
 * The document platform renders Arabic output through html2canvas → jsPDF:
 * text is captured as pixels, so artifact assertions rely on genuine PDF
 * structure (magic bytes, page objects, embedded image streams, page
 * geometry) rather than text extraction.
 */

export type PdfArtifactSummary = Readonly<{
  bytes: number;
  hasPdfMagic: boolean;
  hasEofMarker: boolean;
  pageCount: number;
  /** Width/height (PDF points) of the first MediaBox found — A4 portrait is ~595x842. */
  pageSizePoints: { width: number; height: number } | null;
  /** Byte sizes of embedded image streams, in document order. */
  imageStreamSizes: number[];
  smallestImageStream: number;
  largestImageStream: number;
}>;

const TEXT_DECODER = new TextDecoder('latin1');

export function parsePdfArtifact(buffer: Buffer): PdfArtifactSummary {
  const text = TEXT_DECODER.decode(buffer);

  const hasPdfMagic = text.startsWith('%PDF-');
  const hasEofMarker = /%%EOF\s*$/.test(text);

  const pageMatches = text.match(/\/Type\s*\/Page(?!s)/g) ?? [];
  const pageCount = pageMatches.length;

  let pageSizePoints: { width: number; height: number } | null = null;
  const mediaBox = text.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
  if (mediaBox) {
    pageSizePoints = {
      width: Number.parseFloat(mediaBox[3]) - Number.parseFloat(mediaBox[1]),
      height: Number.parseFloat(mediaBox[4]) - Number.parseFloat(mediaBox[2]),
    };
  }

  // Image XObjects carry each captured A4 page. Measure the stream bodies to
  // prove every page contains real rendered content (a blank page compresses
  // to a tiny stream, so a trailing blank page is detectable).
  const imageStreamSizes: number[] = [];
  const imageObjectPattern = /\/Subtype\s*\/Image[\s\S]{0,400}?stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = imageObjectPattern.exec(text)) !== null) {
    const streamStart = match.index + match[0].length;
    const streamEnd = text.indexOf('endstream', streamStart);
    if (streamEnd === -1) break;
    imageStreamSizes.push(streamEnd - streamStart);
    imageObjectPattern.lastIndex = streamEnd;
  }

  return {
    bytes: buffer.byteLength,
    hasPdfMagic,
    hasEofMarker,
    pageCount,
    pageSizePoints,
    imageStreamSizes,
    smallestImageStream: imageStreamSizes.length > 0 ? Math.min(...imageStreamSizes) : 0,
    largestImageStream: imageStreamSizes.length > 0 ? Math.max(...imageStreamSizes) : 0,
  };
}

/** A4 portrait in PDF points: 595.28 x 841.89 — allow a small rounding window. */
export function isA4Portrait(summary: PdfArtifactSummary): boolean {
  if (!summary.pageSizePoints) return false;
  const { width, height } = summary.pageSizePoints;
  return Math.abs(width - 595.28) < 2 && Math.abs(height - 841.89) < 2;
}

const UNSAFE_FILENAME_PATTERN = /[<>:"/\\|?*\u0000-\u001f]/;
/** An 8+ char lowercase-hex run is the shortened-UUID anti-pattern in file names. */
const UUID_FRAGMENT_PATTERN = /[0-9a-f]{8}/i;

export type FileNameAudit = Readonly<{
  fileName: string;
  safeCharacters: boolean;
  noUuidFragment: boolean;
  withinLengthCap: boolean;
  pdfExtension: boolean;
  passes: boolean;
}>;

export function auditDocumentFileName(fileName: string, forbiddenFragments: readonly string[] = []): FileNameAudit {
  const safeCharacters = fileName.length > 0 && !UNSAFE_FILENAME_PATTERN.test(fileName) && !fileName.startsWith('.') && !fileName.endsWith(' ');
  // An 8+ hex run containing at least one letter is the shortened-UUID
  // anti-pattern; all-digit runs are legitimate dates/serials (e.g. REC-2026-0001).
  const candidateRuns = fileName.match(/[0-9a-fA-F]{8,}/g) ?? [];
  const hexRun = candidateRuns.some((run) => /[a-fA-F]/.test(run) && UUID_FRAGMENT_PATTERN.test(run));
  const seededIdLeak = forbiddenFragments.some((fragment) => fragment.length > 0 && fileName.toLowerCase().includes(fragment.toLowerCase()));
  const noUuidFragment = !hexRun && !seededIdLeak;
  const withinLengthCap = fileName.length <= 96;
  const pdfExtension = fileName.toLowerCase().endsWith('.pdf');
  return {
    fileName,
    safeCharacters,
    noUuidFragment,
    withinLengthCap,
    pdfExtension,
    passes: safeCharacters && noUuidFragment && withinLengthCap && pdfExtension,
  };
}
