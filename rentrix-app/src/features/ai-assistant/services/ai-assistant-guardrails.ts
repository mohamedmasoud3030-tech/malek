const sqlStatementPattern = /\b(select|insert|update|delete|drop|alter|truncate|create|grant|revoke)\b[\s\S]*(\bfrom\b|\binto\b|\btable\b|\bset\b|;)/i;

export class AiAssistantConfigurationError extends Error {
  readonly code = 'AI_CONFIG_MISSING';

  constructor(message = 'إعدادات الذكاء الاصطناعي غير مكتملة') {
    super(message);
    this.name = 'AiAssistantConfigurationError';
  }
}

export function isAiAssistantConfigurationError(error: unknown): error is AiAssistantConfigurationError {
  return error instanceof AiAssistantConfigurationError;
}

export function looksLikeRawSqlPrompt(prompt: string): boolean {
  return sqlStatementPattern.test(prompt.trim());
}
