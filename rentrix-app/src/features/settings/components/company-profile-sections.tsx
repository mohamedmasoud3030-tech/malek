import type { ChangeEvent } from 'react';
import type {
  CompanySettingsDraft,
  CompanySettingsDraftField,
  CompanySettingsPreviewModel,
  CompanySettingsValidationErrors,
} from '../settingsForm';
import { OfficeSection } from '../sections/OfficeSection';
import { IdentitySection } from '../sections/IdentitySection';
import { DocumentsSection } from '../sections/DocumentsSection';
import type { SettingsSectionId } from '../registry/sectionRegistry';

type CompanyProfileSectionsProps = Readonly<{
  activeSection: SettingsSectionId;
  draft: CompanySettingsDraft;
  errors: CompanySettingsValidationErrors;
  isSaving: boolean;
  preview: CompanySettingsPreviewModel;
  formattedPreviewDate: string;
  formattedPreviewMoney: string;
  onDraftChange: (field: CompanySettingsDraftField, value: string) => void;
  onLogoFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}>;

/**
 * Compatibility composition (WP-D seam): renders the three core
 * company-profile sections (office, identity, documents). The Settings page
 * itself now composes sections from the registry; this module is kept for
 * legacy consumers (settings e2e fixture, embedded surfaces) so the import
 * path and prop contract stay intact.
 */
export function CompanyProfileSections({
  activeSection,
  draft,
  errors,
  isSaving,
  preview,
  formattedPreviewDate,
  formattedPreviewMoney,
  onDraftChange,
  onLogoFileChange,
}: CompanyProfileSectionsProps) {
  return (
    <>
      <OfficeSection
        activeSection={activeSection}
        draft={draft}
        errors={errors}
        isSaving={isSaving}
        onDraftChange={onDraftChange}
      />
      <IdentitySection
        activeSection={activeSection}
        draft={draft}
        errors={errors}
        isSaving={isSaving}
        preview={preview}
        formattedPreviewDate={formattedPreviewDate}
        formattedPreviewMoney={formattedPreviewMoney}
        onDraftChange={onDraftChange}
        onLogoFileChange={onLogoFileChange}
      />
      <DocumentsSection
        activeSection={activeSection}
        draft={draft}
        errors={errors}
        isSaving={isSaving}
        onDraftChange={onDraftChange}
      />
    </>
  );
}
