export type JsonObject = Record<string, unknown>;

export type ChatRole = "system" | "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export const AI_PROMPT_VERSION = "malek-ops-ar-v3";
export const AI_OUTPUT_SCHEMA_VERSION = "assistant-response-v1";
export const AI_ACTIONS = [
  "freeform",
  "summarize_overdue_invoices",
  "summarize_contract_renewals",
  "summarize_vacancy",
  "summarize_month",
  "draft_tenant_payment_reminder",
  "explain_property_financial_snapshot",
  "explain_current_surface",
  "identify_riskiest_overdue_tenants",
  "list_contracts_needing_action_this_week",
  "locate_dormant_funds",
  "list_vacant_units_needing_followup",
  "identify_lowest_performing_properties",
  "list_overdue_or_critical_maintenance",
  "prioritize_office_actions_top5",
  "generate_daily_brief",
  "draft_contract_renewal_followup",
  "draft_maintenance_followup",
  "draft_owner_summary",
  "draft_internal_note",
] as const;
export type AiAction = (typeof AI_ACTIONS)[number];

export type ValidatedAssistantRequest = {
  requestId: string;
  prompt: string;
  action: AiAction;
  context: JsonObject;
  history: ChatMessage[];
};

export type AssistantOutput = {
  answer: string;
  grounded: boolean;
  caveats: string[];
};

export type ProviderUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

export type ProviderResult = {
  output: AssistantOutput;
  durationMs: number;
  usage: ProviderUsage;
};

export type ProviderRequest = {
  model: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
  timeoutMs: number;
};

export interface AiProviderAdapter {
  readonly provider: string;
  generate(request: ProviderRequest): Promise<ProviderResult>;
}

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readBoundedString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function validateAssistantOutput(
  value: unknown,
): AssistantOutput | null {
  if (!isRecord(value)) return null;
  const answer = readBoundedString(value.answer, 6_000);
  if (
    !answer ||
    typeof value.grounded !== "boolean" ||
    !Array.isArray(value.caveats)
  )
    return null;

  const caveats: string[] = [];
  for (const caveat of value.caveats) {
    if (
      typeof caveat !== "string" ||
      caveat.trim().length === 0 ||
      caveat.length > 500
    )
      return null;
    caveats.push(caveat.trim());
    if (caveats.length > 5) return null;
  }
  return { answer, grounded: value.grounded, caveats };
}
