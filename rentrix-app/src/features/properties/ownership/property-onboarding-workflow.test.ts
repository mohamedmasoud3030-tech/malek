import { describe, expect, it } from 'vitest';
import {
  PROPERTY_ONBOARDING_EVIDENCE_TITLES,
  PROPERTY_ONBOARDING_STEP_IDS,
  derivePropertyOnboardingWorkflow,
  isPropertyOnboardingComplete,
} from './property-onboarding-workflow';

describe('property onboarding workflow', () => {
  it('uses the exact seven canonical D12 steps in order', () => {
    const steps = derivePropertyOnboardingWorkflow({
      property: { title: '', type: '', address: '' },
      ownerAndAgreementReady: false,
      unitCount: 0,
      documents: [],
    });

    expect(steps.map((step) => step.id)).toEqual(PROPERTY_ONBOARDING_STEP_IDS);
    expect(isPropertyOnboardingComplete(steps)).toBe(false);
  });

  it('requires deliberate inspection/risk/handover evidence and closes only when all seven are complete', () => {
    const steps = derivePropertyOnboardingWorkflow({
      property: { title: 'بيت النخيل', type: 'سكني', address: 'مسقط' },
      ownerAndAgreementReady: true,
      unitCount: 2,
      documents: [
        { title: PROPERTY_ONBOARDING_EVIDENCE_TITLES.INSPECTION },
        { title: PROPERTY_ONBOARDING_EVIDENCE_TITLES.RISK_ASSESSMENT },
        { title: PROPERTY_ONBOARDING_EVIDENCE_TITLES.HANDOVER },
      ],
    });

    expect(steps.every((step) => step.complete)).toBe(true);
    expect(isPropertyOnboardingComplete(steps)).toBe(true);
  });

  it('does not let an arbitrary property document masquerade as inspection or handover evidence', () => {
    const steps = derivePropertyOnboardingWorkflow({
      property: { title: 'بيت النخيل', type: 'سكني', address: 'مسقط' },
      ownerAndAgreementReady: true,
      unitCount: 1,
      documents: [{ title: 'صورة العقار.jpg' }],
    });

    expect(steps.find((step) => step.id === 'DOCUMENTS')?.complete).toBe(true);
    expect(steps.find((step) => step.id === 'INSPECTION')?.complete).toBe(false);
    expect(steps.find((step) => step.id === 'RISK_ASSESSMENT')?.complete).toBe(false);
    expect(steps.find((step) => step.id === 'HANDOVER')?.complete).toBe(false);
    expect(isPropertyOnboardingComplete(steps)).toBe(false);
  });
});
