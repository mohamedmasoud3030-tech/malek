/**
 * EnterpriseForm — Enterprise UX Foundation (Wave 4A)
 *
 * Reusable form *layout* engine (library-agnostic): sections-in-cards,
 * optional tab grouping, validation summary with anchor links, readonly /
 * disabled propagation through <fieldset>, and a sticky footer with standard
 * submit/cancel actions.
 *
 * It deliberately knows nothing about react-hook-form, zod, or any module's
 * validation: wire whatever state you have through `errors`, `disabled`,
 * `onSubmit`, and the section children.
 *
 * @example
 * <EnterpriseForm
 *   onSubmit={form.handleSubmit(save)}
 *   errors={errors}
 *   isSubmitting={saving}
 *   sections={[
 *     { id: 'basic', title: 'البيانات الأساسية', content: <BasicFields /> },
 *     { id: 'notes', title: 'ملاحظات', content: <NotesField /> },
 *   ]}
 * />
 */

import { AlertTriangle } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { EnterpriseSection } from './enterprise-section';
import { EnterpriseStickyFooter } from './enterprise-sticky-footer';
import { EnterpriseTabs, type EnterpriseTab } from './enterprise-tabs';

export interface EnterpriseFormError {
  /** Human-readable validation message (module copy). */
  message: string;
  /**
   * Optional DOM id of the field/section — the summary links to it
   * (`href="#fieldId"`). Point it at the field's `id` for focus jump.
   */
  fieldId?: string;
}

export interface EnterpriseFormSection {
  id: string;
  title?: string;
  description?: string;
  /** Wrap the section in a Card surface. Default true. */
  card?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** Section trailing actions (e.g. "add row"). */
  actions?: ReactNode;
  /** Field grid inside the section. */
  columns?: 1 | 2;
  content: ReactNode;
}

export interface EnterpriseFormTab extends Omit<EnterpriseTab, 'content'> {
  sections: EnterpriseFormSection[];
}

export interface EnterpriseFormProps {
  /** Sections layout (ignored when `tabs` is provided). */
  sections?: EnterpriseFormSection[];
  /** Tab layout — each tab groups its own sections. */
  tabs?: EnterpriseFormTab[];
  value?: string;
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
  /** Free-form children when neither sections nor tabs fit. */
  children?: ReactNode;

  /** Native submit wiring — receives the <form> submit event. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;

  // Validation
  errors?: EnterpriseFormError[];
  errorsTitle?: string;

  // State propagation
  disabled?: boolean;
  readOnly?: boolean;

  // Footer
  footer?: ReactNode;
  /** Hide the default footer entirely (e.g. embedded in a drawer footer). */
  hideFooter?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  isSubmitting?: boolean;
  footerExtras?: ReactNode;

  id?: string;
  className?: string;
}

function SectionBody({ section }: { section: EnterpriseFormSection }) {
  const body = (
    <div
      className={cn(
        section.columns === 2 && 'grid gap-4 sm:grid-cols-2 [&>*]:min-w-0',
      )}
    >
      {section.content}
    </div>
  );

  const inner = section.title !== undefined || section.description !== undefined ? (
    <EnterpriseSection
      id={section.id}
      title={section.title}
      description={section.description}
      actions={section.actions}
      collapsible={section.collapsible}
      defaultCollapsed={section.defaultCollapsed}
    >
      {body}
    </EnterpriseSection>
  ) : (
    <div id={section.id}>{body}</div>
  );

  if (section.card === false) return inner;

  return (
    <Card data-enterprise-form-section data-section={section.id} className="p-4 sm:p-6">
      {inner}
    </Card>
  );
}

export function EnterpriseForm({
  sections,
  tabs,
  value,
  defaultTab,
  onTabChange,
  children,
  onSubmit,
  errors,
  errorsTitle = 'يرجى تصحيح الأخطاء التالية قبل الحفظ:',
  disabled = false,
  readOnly = false,
  footer,
  hideFooter = false,
  submitLabel = 'حفظ',
  cancelLabel = 'إلغاء',
  onCancel,
  isSubmitting = false,
  footerExtras,
  id,
  className,
}: EnterpriseFormProps) {
  const contents =
    tabs !== undefined ? (
      <EnterpriseTabs
        tabs={tabs.map((tab) => ({
          ...tab,
          content: (
            <div className="space-y-4">
              {tab.sections.map((section) => (
                <SectionBody key={section.id} section={section} />
              ))}
            </div>
          ),
        }))}
        value={value}
        defaultValue={defaultTab}
        onValueChange={onTabChange}
      />
    ) : sections !== undefined ? (
      <div className="space-y-4">
        {sections.map((section) => (
          <SectionBody key={section.id} section={section} />
        ))}
      </div>
    ) : (
      children
    );

  return (
    <form
      id={id}
      data-enterprise-form
      data-readonly={readOnly || undefined}
      data-disabled={disabled || undefined}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(event);
      }}
      className={cn('flex flex-col gap-4', className)}
    >
      {errors && errors.length > 0 ? (
        <div
          data-enterprise-form-errors
          role="alert"
          className="flex gap-3 rounded-2xl border border-danger/25 bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-bold">{errorsTitle}</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-[0.8125rem] font-medium">
              {errors.map((error, index) => (
                <li key={`${index}-${error.message}`}>
                  {error.fieldId ? (
                    <a
                      href={`#${error.fieldId}`}
                      className="underline underline-offset-2 hover:text-danger/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
                    >
                      {error.message}
                    </a>
                  ) : (
                    error.message
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {disabled || readOnly ? (
        <fieldset disabled className="contents" aria-readonly={readOnly || undefined}>
          {contents}
        </fieldset>
      ) : (
        contents
      )}

      {!hideFooter ? (
        <EnterpriseStickyFooter align="between" position="sticky">
          <div className="flex flex-wrap items-center gap-2">{footerExtras}</div>
          {footer ?? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              {onCancel !== undefined ? (
                <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
                  {cancelLabel}
                </Button>
              ) : null}
              {!readOnly ? (
                <Button type="submit" variant="primary" disabled={disabled || isSubmitting}>
                  {isSubmitting ? (
                    <span
                      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden="true"
                    />
                  ) : null}
                  {isSubmitting ? 'جارٍ الحفظ...' : submitLabel}
                </Button>
              ) : null}
            </div>
          )}
        </EnterpriseStickyFooter>
      ) : null}
    </form>
  );
}
