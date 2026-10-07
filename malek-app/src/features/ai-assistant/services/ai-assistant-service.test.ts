import { describe, expect, it } from 'vitest';
import {
  AiAssistantConfigurationError,
  isAiAssistantConfigurationError,
  looksLikeRawSqlPrompt,
} from './ai-assistant-guardrails';

describe('ai assistant service guardrails', () => {
  it('rejects raw SQL-looking prompts before sending them to the backend', () => {
    expect(looksLikeRawSqlPrompt('select * from invoices;')).toBe(true);
    expect(looksLikeRawSqlPrompt('DELETE FROM payments WHERE id = 1')).toBe(true);
  });

  it('allows normal Arabic operational prompts', () => {
    expect(looksLikeRawSqlPrompt('لخص الفواتير المتأخرة لهذا الأسبوع')).toBe(false);
    expect(looksLikeRawSqlPrompt('اكتب تذكير دفع مهذب للمستأجر')).toBe(false);
  });

  it('exposes a typed missing-configuration error for the UI state', () => {
    const error = new AiAssistantConfigurationError();
    expect(isAiAssistantConfigurationError(error)).toBe(true);
    expect(error.message).toBe('إعدادات الذكاء الاصطناعي غير مكتملة');
  });
});
