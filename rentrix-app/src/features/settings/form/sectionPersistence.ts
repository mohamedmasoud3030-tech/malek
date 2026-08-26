import {
  companySettingsSectionDraftFields,
  type CompanySettingsDraft,
  type CompanySettingsDraftField,
  type CompanySettingsSectionDraftId,
} from './sectionDrafts';

/**
 * WP-D D.4 — section-level persistence contract (definition only).
 *
 * Backend work is intentionally out of scope for this refactor: the current
 * save path is a single `PATCH`-style row update through
 * `companySettingsService.updateCompanySettings` and it is preserved as-is
 * (no Supabase schema change, no new API). This module pins the contract a
 * future `PATCH /api/settings/{section}` endpoint must honour so the client
 * and server agree on field ownership before such an endpoint ships:
 *
 *   PATCH /api/settings/{section}
 *   Content-Type: application/json
 *   Auth: `company.settings.manage`
 *   Body:   { "<field owned by section>": <value>, ... }  — unknown fields rejected (400)
 *   Result: 200 + the full normalized `company_settings` row
 *   Semantics:
 *     - PATCH updates only the listed fields; unspecified owned fields are left untouched.
 *     - Section payloads are composable: the union of all four section payloads
 *       equals today's single update payload.
 *     - Server applies the same normalization as `normalizeCompanySettingsUpdatePayload`
 *       (required-field fallbacks, VAT rate clamping, boolean coercion).
 *     - Immutable columns (id, company_id, singleton_key, created_at) are never
 *       writable through any section endpoint.
 */
export type SettingsSectionPersistenceMethod = 'PATCH';

export type SettingsSectionPersistenceEndpoint = `/api/settings/${CompanySettingsSectionDraftId}`;

export type SettingsSectionPersistenceContract = Readonly<{
  method: SettingsSectionPersistenceMethod;
  endpoint: SettingsSectionPersistenceEndpoint;
  auth: 'company.settings.manage';
  fields: readonly CompanySettingsDraftField[];
  response: 'company_settings row';
  idempotent: true;
}>;

export function buildSettingsSectionPersistenceContract(
  sectionId: CompanySettingsSectionDraftId,
): SettingsSectionPersistenceContract {
  return {
    method: 'PATCH',
    endpoint: `/api/settings/${sectionId}`,
    auth: 'company.settings.manage',
    fields: companySettingsSectionDraftFields[sectionId],
    response: 'company_settings row',
    idempotent: true,
  };
}

/**
 * Extracts only the fields owned by `sectionId` from a full draft — the exact
 * payload shape a section-level endpoint accepts, and the same slice
 * `useSettingsSection` surfaces for editing.
 */
export function sectionDraftToSectionPayload(
  draft: CompanySettingsDraft,
  sectionId: CompanySettingsSectionDraftId,
): Partial<CompanySettingsDraft> {
  const payload: Partial<CompanySettingsDraft> = {};

  for (const field of companySettingsSectionDraftFields[sectionId]) {
    payload[field] = draft[field];
  }

  return payload;
}

/**
 * Composition invariant: every persisted draft field is covered by exactly one
 * section contract, so the four section payloads merge into today's full
 * update payload without gaps or duplicates.
 */
export function assertSectionFieldOwnership(draft: CompanySettingsDraft): Partial<CompanySettingsDraft> {
  const composed: Partial<CompanySettingsDraft> = {};

  for (const sectionId of Object.keys(companySettingsSectionDraftFields) as CompanySettingsSectionDraftId[]) {
    Object.assign(composed, sectionDraftToSectionPayload(draft, sectionId));
  }

  return composed;
}
