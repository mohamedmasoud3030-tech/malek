import { useCallback, useMemo } from 'react';
import {
  companySettingsSectionDraftFields,
  hasCompanySettingsValidationErrors,
  validateSettingsSectionDraft,
  type CompanySettingsDraft,
  type CompanySettingsDraftField,
  type CompanySettingsSectionDraftId,
  type CompanySettingsSectionDraftMap,
  type CompanySettingsValidationErrors,
} from './sectionDrafts';

export type UseSettingsSectionOptions = Readonly<{
  draft: CompanySettingsDraft;
  errors: CompanySettingsValidationErrors;
  isSaving: boolean;
  onDraftChange: (field: CompanySettingsDraftField, value: string) => void;
}>;

export type SettingsSectionDraftState<TId extends CompanySettingsSectionDraftId> = Readonly<{
  sectionId: TId;
  /** Fields owned by this section — the isolation contract (D.3). */
  fields: readonly CompanySettingsDraftField[];
  /** Draft slice scoped to this section only. */
  draft: CompanySettingsSectionDraftMap[TId];
  /** Validation errors scoped to this section only. */
  errors: CompanySettingsValidationErrors;
  /** Fresh validation of this section's slice on the current full draft. */
  validationErrors: CompanySettingsValidationErrors;
  isSectionValid: boolean;
  isSaving: boolean;
  setField: (field: CompanySettingsDraftField, value: string) => void;
}>;

/**
 * WP-D D.3 — isolated draft/validation/preview per settings section.
 *
 * Sections no longer reach into the monolithic draft: each form section asks
 * for its owned slice, its owned errors, and a `setField` handler that rejects
 * writes to fields owned by other sections. State itself stays in the
 * controller (one persisted row, one save payload — preserved behavior); this
 * hook is the per-section view + validation boundary.
 */
export function useSettingsSection<TId extends CompanySettingsSectionDraftId>(
  sectionId: TId,
  options: UseSettingsSectionOptions,
): SettingsSectionDraftState<TId> {
  const fields = companySettingsSectionDraftFields[sectionId];

  const draft = useMemo(() => {
    const slice = {} as Record<CompanySettingsDraftField, string>;
    for (const field of fields) {
      slice[field] = options.draft[field];
    }
    return slice as CompanySettingsSectionDraftMap[TId];
  }, [options.draft, fields]);

  const errors = useMemo(() => {
    const scopedErrors: CompanySettingsValidationErrors = {};
    for (const field of fields) {
      if (options.errors[field]) scopedErrors[field] = options.errors[field];
    }
    return scopedErrors;
  }, [options.errors, fields]);

  const validationErrors = useMemo(
    () => validateSettingsSectionDraft(options.draft, sectionId),
    [options.draft, sectionId],
  );

  const setField = useCallback((field: CompanySettingsDraftField, value: string) => {
    if ((fields as readonly string[]).includes(field)) {
      options.onDraftChange(field, value);
    }
  }, [fields, options.onDraftChange]);

  return {
    sectionId,
    fields,
    draft,
    errors,
    validationErrors,
    isSectionValid: !hasCompanySettingsValidationErrors(validationErrors),
    isSaving: options.isSaving,
    setField,
  };
}
