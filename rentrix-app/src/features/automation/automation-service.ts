import type { AutomationRule, AutomationStatus } from './types';

/**
 * Provider-neutral automation boundary.
 *
 * The current automation screen is intentionally local-preview only. A worker,
 * scheduler, or provider can implement this interface later without changing
 * rule cards, filters, or status UX.
 */
export type AutomationCommand = Readonly<{
  ruleId: string;
  status: AutomationStatus;
  requestedBy?: string;
}>;

export type AutomationCommandResult = Readonly<{
  accepted: boolean;
  provider: 'local-preview' | 'automation-worker';
  message: string;
}>;

export interface AutomationGateway {
  updateRule(command: AutomationCommand): Promise<AutomationCommandResult>;
  previewRule(rule: AutomationRule): AutomationCommandResult;
}

export const localAutomationGateway: AutomationGateway = {
  async updateRule() {
    return {
      accepted: false,
      provider: 'local-preview',
      message: 'تم حفظ الحالة محلياً للمعاينة. لم يتم تشغيل عامل أتمتة خارجي.',
    };
  },
  previewRule(rule) {
    return {
      accepted: true,
      provider: 'local-preview',
      message: `معاينة قاعدة: ${rule.name}`,
    };
  },
};
