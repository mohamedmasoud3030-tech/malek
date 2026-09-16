/**
 * Golden gate NODE entry — real outputs, no browser needed for the PDF side.
 *
 * Bundled (esbuild, platform=node) and driven by scripts/verify-golden-documents.mjs:
 *  - `pdfFor(id)` renders the model through the VECTOR emitter (@react-pdf)
 *    with the self-hosted Tajawal TTFs and returns raw PDF bytes;
 *  - `printableHtmlFor(id)` returns the standalone print sheet, which the
 *    driver feeds to headless Chromium to produce the BROWSER-print PDF.
 * Both artifacts are real files the driver compares (pages, text, parity).
 */
import { createElement as h, type ReactElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { goldenScenarios } from './golden-document-scenarios';
import type { UnifiedDocumentModel } from '@/services/documents/types';
import { buildPrintableDocumentHtml } from '@/services/documents/renderer/documentHtml';
import { ModelPdfDocument, registerDocumentPdfFonts } from '@/services/documents/renderer/pdf/pdfDocument';

// Node resolves the TTFs straight from the repository's public assets.
registerDocumentPdfFonts('public/fonts/');

const scenarioOf = (id: string) => {
  const scenario = goldenScenarios.find((candidate) => candidate.id === id);
  if (!scenario) throw new Error(`unknown golden scenario: ${id}`);
  return scenario;
};

export const list = () => goldenScenarios.map((scenario) => ({ id: scenario.id, name: scenario.name, expect: scenario.expect }));

export const modelOf = (id: string): UnifiedDocumentModel => scenarioOf(id).model;

export const printableHtmlFor = (id: string): string => buildPrintableDocumentHtml(scenarioOf(id).model);

const countPages = (text: string): number => {
  const tree = text.match(/\/Type\s*\/Pages[\s\S]{0,120}?\/Count\s+(\d+)/) ?? text.match(/\/Count\s+(\d+)\s*\/Kids/);
  return tree ? Number(tree[1]) : 0;
};

export async function pdfForModel(model: UnifiedDocumentModel): Promise<{ base64: string; pageCount: number; sizeBytes: number }> {
  // ModelPdfDocument renders <Document>; pdf() wants the element typed as
  // DocumentProps, so bridge the function-component element here.
  const stream = await pdf(h(ModelPdfDocument, { model }) as unknown as ReactElement<Parameters<typeof pdf>[0] extends ReactElement<infer P, any> ? P : never>).toBuffer();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const buffer = Buffer.concat(chunks);
  return { base64: buffer.toString('base64'), pageCount: countPages(buffer.toString('latin1')), sizeBytes: buffer.length };
}

export async function pdfFor(id: string): Promise<{ base64: string; pageCount: number; sizeBytes: number }> {
  return pdfForModel(scenarioOf(id).model);
}

/** Strings that MUST survive into the printed PDF as extractable text. */
export function mustContainFor(id: string): string[] {
  const model = scenarioOf(id).model;
  const table = model.professional ? undefined : model.tables[0];
  const proTable = model.professional?.groups.flatMap((g) => g.blocks).find((b) => b.kind === 'table');
  const source = table ?? (proTable && proTable.kind === 'table' ? proTable.table : undefined);
  const lastRow = source?.rows[source.rows.length - 1];
  const amount = lastRow?.[lastRow.length - 1];
  return [model.header.companyName, model.header.title, amount, model.header.documentNo].filter((v): v is string => Boolean(v));
}

/** First table header cell — used to prove the header repeats on page 2. */
export function longTableHeaderFor(id: string): string {
  const model = scenarioOf(id).model;
  return model.tables[0]?.columns[0] ?? '';
}
