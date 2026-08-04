/**
 * Stage 3 — journal service boundary (read-only for browsers).
 *
 * Browsers can READ batches and lines (company-scoped, ADMIN/MANAGER) and can
 * never write: the posting engine RPCs (gl_create_journal_batch,
 * gl_post_journal_batch, post_journal_event, reverse_journal_batch) are
 * service_role-only, and RLS blocks every direct table write. Stage 4+
 * business postings will call the engine from trusted SECURITY DEFINER
 * contexts; this module exposes the typed payload builders those contexts use
 * plus the read APIs the app may consume.
 */
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import type { JournalBatch, JournalEventInput, JournalLine, JournalLineInput, JournalBatchesList, JournalLinesList } from './accountingDomain';

export type JournalBatchFilters = Readonly<{
  status?: JournalBatch['status'] | null;
  sourceType?: string | null;
  sourceId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  limit?: number | null;
}>;

function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNullableString(value: unknown): string | null {
  return value == null ? null : asString(value);
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function listJournalBatches(filters: JournalBatchFilters = {}): Promise<JournalBatch[]> {
  try {
    const payload: Record<string, string | number> = {};
    if (filters.status) payload.status = filters.status;
    if (filters.sourceType) payload.source_type = filters.sourceType;
    if (filters.sourceId) payload.source_id = filters.sourceId;
    if (filters.fromDate) payload.from_date = filters.fromDate;
    if (filters.toDate) payload.to_date = filters.toDate;
    if (filters.limit) payload.limit = filters.limit;
    const { data, error } = await supabase.rpc('list_journal_batches', { p_payload: payload });
    if (error) throw error;
    const root = asRecord(data);
    const rows = Array.isArray(root.batches) ? root.batches : [];
    return rows.map((row) => {
      const r = asRecord(row);
      return {
        id: asString(r.id),
        company_id: asString(r.company_id),
        status: (asString(r.status) || 'DRAFT') as JournalBatch['status'],
        source_type: asString(r.source_type),
        source_id: asString(r.source_id),
        event_id: asString(r.event_id),
        reversal_of_batch_id: asNullableString(r.reversal_of_batch_id),
        is_legacy_compat: r.is_legacy_compat === true,
        effective_date: asString(r.effective_date),
        accounting_period_id: asNullableString(r.accounting_period_id),
        period_resolution_reason: asNullableString(r.period_resolution_reason),
        posted_at: asNullableString(r.posted_at),
        posted_by: asNullableString(r.posted_by),
        description: asNullableString(r.description),
        created_at: asString(r.created_at),
        created_by: asNullableString(r.created_by),
        updated_at: asString(r.updated_at),
      };
    });
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل قيود اليومية');
    return [];
  }
}

export async function listJournalLines(batchId: string): Promise<JournalLine[]> {
  try {
    const { data, error } = await supabase.rpc('list_journal_lines', { p_batch_id: batchId });
    if (error) throw error;
    const root = asRecord(data);
    const rows = Array.isArray(root.lines) ? root.lines : [];
    return rows.map((row) => {
      const r = asRecord(row);
      return {
        id: asString(r.id),
        no: asNullableString(r.no),
        date: asNullableString(r.date),
        batch_id: asString(r.batch_id),
        company_id: asString(r.company_id),
        account_id: asString(r.account_id),
        debit: asNumber(r.debit),
        credit: asNumber(r.credit),
        line_description: asNullableString(r.line_description),
        ref_source_id: asNullableString(r.ref_source_id),
        ref_entity_type: asNullableString(r.ref_entity_type),
        ref_entity_id: asNullableString(r.ref_entity_id),
        request_id: asNullableString(r.request_id),
        deleted_at: asNullableString(r.deleted_at),
        created_at: asString(r.created_at),
      };
    });
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل بنود القيد');
    return [];
  }
}

export async function listJournalBatchesEnvelope(): Promise<JournalBatchesList | null> {
  try {
    const { data, error } = await supabase.rpc('list_journal_batches', { p_payload: {} });
    if (error) throw error;
    return (data ?? {}) as JournalBatchesList;
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل قيود اليومية');
    return null;
  }
}

export async function listJournalLinesEnvelope(batchId: string): Promise<JournalLinesList | null> {
  try {
    const { data, error } = await supabase.rpc('list_journal_lines', { p_batch_id: batchId });
    if (error) throw error;
    return (data ?? {}) as JournalLinesList;
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل بنود القيد');
    return null;
  }
}

/**
 * Validates a line input exactly like the engine does (one positive side,
 * three-decimal normalization) and returns the normalized line. This is a
 * PURE helper for server-side contexts and tests — it performs no I/O.
 */
export function normalizeJournalLineInput(line: JournalLineInput): { debit: number; credit: number } {
  const debit = Math.round((Number(line.debit ?? 0) + Number.EPSILON) * 1000) / 1000;
  const credit = Math.round((Number(line.credit ?? 0) + Number.EPSILON) * 1000) / 1000;
  if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
    throw new Error('JOURNAL_LINE_SIDE_INVALID: each line must contain exactly one positive side (debit XOR credit).');
  }
  if (debit < 0 || credit < 0) {
    throw new Error('JOURNAL_LINE_NEGATIVE_INVALID: negative debit/credit amounts are not allowed.');
  }
  return { debit, credit };
}

/**
 * Builds the canonical idempotent event payload for the engine. Browser code
 * must NOT call post_journal_event directly (service_role-only); this builder
 * exists for trusted server contexts and for contract tests of the engine.
 */
export function buildJournalEventPayload(input: JournalEventInput): JournalEventInput {
  if (!input.company_id || !input.source_type || !input.source_id || !input.event_id || !input.effective_date) {
    throw new Error('GL_EVENT_METADATA_REQUIRED: company_id, source_type, source_id, event_id and effective_date are required.');
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error('JOURNAL_BATCH_EMPTY: at least one journal line is required.');
  }
  for (const line of input.lines) normalizeJournalLineInput(line);
  return input;
}
