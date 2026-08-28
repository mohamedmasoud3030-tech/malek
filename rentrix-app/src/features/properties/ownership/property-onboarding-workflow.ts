export const PROPERTY_ONBOARDING_STEP_IDS = [
  'PROPERTY_INFO',
  'OWNER_AND_AGREEMENT',
  'DOCUMENTS',
  'UNITS',
  'INSPECTION',
  'RISK_ASSESSMENT',
  'HANDOVER',
] as const;

export type PropertyOnboardingStepId = (typeof PROPERTY_ONBOARDING_STEP_IDS)[number];

export const PROPERTY_ONBOARDING_EVIDENCE_TITLES = {
  INSPECTION: 'محضر فحص استلام العقار',
  RISK_ASSESSMENT: 'تقييم مخاطر العقار',
  HANDOVER: 'محضر تسليم العقار والمفاتيح',
} as const satisfies Partial<Record<PropertyOnboardingStepId, string>>;

export type PropertyOnboardingDocument = Readonly<{ title: string }>;

export type PropertyOnboardingWorkflowInput = Readonly<{
  property: Readonly<{
    title?: string | null;
    type?: string | null;
    address?: string | null;
  }> | null | undefined;
  ownerAndAgreementReady: boolean;
  unitCount: number;
  documents: readonly PropertyOnboardingDocument[];
}>;

export type PropertyOnboardingWorkflowStep = Readonly<{
  id: PropertyOnboardingStepId;
  label: string;
  description: string;
  complete: boolean;
  evidenceTitle?: string;
}>;

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasDocument(documents: readonly PropertyOnboardingDocument[], title: string): boolean {
  const expected = title.trim();
  return documents.some((document) => document.title.trim() === expected);
}

/**
 * Canonical D12 property onboarding projection.
 *
 * This helper does not invent a parallel state machine. Every step is derived
 * from an existing property authority (property/ownership/units/vault docs),
 * and the three evidence-heavy steps use fixed document titles so arbitrary
 * uploads cannot accidentally satisfy inspection, risk, or handover.
 */
export function derivePropertyOnboardingWorkflow(
  input: PropertyOnboardingWorkflowInput,
): PropertyOnboardingWorkflowStep[] {
  const propertyInfoComplete = Boolean(
    input.property
    && hasText(input.property.title)
    && hasText(input.property.type)
    && hasText(input.property.address),
  );

  return [
    {
      id: 'PROPERTY_INFO',
      label: 'بيانات العقار',
      description: 'الاسم والنوع والعنوان الأساسي.',
      complete: propertyInfoComplete,
    },
    {
      id: 'OWNER_AND_AGREEMENT',
      label: 'المالك واتفاقية الإدارة',
      description: 'ملكية سارية واتفاقية إدارة تغطي التشغيل.',
      complete: input.ownerAndAgreementReady,
    },
    {
      id: 'DOCUMENTS',
      label: 'المستندات الأساسية',
      description: 'وجود مستند واحد على الأقل في ملف العقار.',
      complete: input.documents.length > 0,
    },
    {
      id: 'UNITS',
      label: 'الوحدات',
      description: 'تسجيل وحدة واحدة على الأقل قبل بدء التشغيل.',
      complete: input.unitCount > 0,
    },
    {
      id: 'INSPECTION',
      label: 'فحص الاستلام',
      description: 'إثبات حالة العقار عند الاستلام قبل بدء الإدارة.',
      complete: hasDocument(input.documents, PROPERTY_ONBOARDING_EVIDENCE_TITLES.INSPECTION),
      evidenceTitle: PROPERTY_ONBOARDING_EVIDENCE_TITLES.INSPECTION,
    },
    {
      id: 'RISK_ASSESSMENT',
      label: 'تقييم المخاطر',
      description: 'توثيق الملاحظات والمخاطر التشغيلية قبل التفعيل.',
      complete: hasDocument(input.documents, PROPERTY_ONBOARDING_EVIDENCE_TITLES.RISK_ASSESSMENT),
      evidenceTitle: PROPERTY_ONBOARDING_EVIDENCE_TITLES.RISK_ASSESSMENT,
    },
    {
      id: 'HANDOVER',
      label: 'التسليم والمفاتيح',
      description: 'محضر التسليم النهائي والمفاتيح أو ما يعادلها من إثبات.',
      complete: hasDocument(input.documents, PROPERTY_ONBOARDING_EVIDENCE_TITLES.HANDOVER),
      evidenceTitle: PROPERTY_ONBOARDING_EVIDENCE_TITLES.HANDOVER,
    },
  ];
}

export function isPropertyOnboardingComplete(steps: readonly PropertyOnboardingWorkflowStep[]): boolean {
  return steps.length === PROPERTY_ONBOARDING_STEP_IDS.length && steps.every((step) => step.complete);
}
