export type JsonObject = Record<string, unknown>;

export type ChatRole = "system" | "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export const AI_PROMPT_VERSION = "malek-ops-ar-v4";
export const AI_OUTPUT_SCHEMA_VERSION = "assistant-response-v1";
export const AI_PLANNING_SCHEMA_VERSION = "assistant-planning-v2";
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

/**
 * Planning intents: the closed action union plus `advisory` — a general
 * property-business question (market rates, rent estimation, management
 * practice) answered from the versioned business knowledge base instead of
 * the user's own data.
 */
export const PLANNING_INTENTS = [...AI_ACTIONS, "advisory"] as const;
export type PlanningIntent = (typeof PLANNING_INTENTS)[number];

/**
 * Selectable company-data sections for on-demand context assembly. The
 * planning call picks the minimal set the question needs; `surface` and
 * `entity` are always attached and are intentionally not selectable.
 */
export const CONTEXT_SECTIONS = [
  "overdueInvoices",
  "contractRenewals",
  "propertyFinancialSnapshot",
  "reportSummary",
  "maintenanceSnapshot",
  "vacancyDetail",
  "propertyPerformance",
  "depositHeld",
] as const;
export type ContextSection = (typeof CONTEXT_SECTIONS)[number];

export type AssistantPlanning = {
  intent: PlanningIntent;
  /** Selected context sections; undefined = everything (degraded path). */
  sections?: ContextSection[];
};

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

export type ProviderClassificationResult = {
  output: AssistantPlanning;
  durationMs: number;
  usage: ProviderUsage;
};

export type ProviderRequest = {
  model: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
  timeoutMs: number;
};

/**
 * One narrow adapter boundary: every provider call returns strict
 * JSON-schema output that is validated against its contract before it is
 * trusted. `generate` answers (response schema); `classify` runs the tiny
 * freeform planning call (planning schema).
 */
export interface AiProviderAdapter {
  readonly provider: string;
  generate(request: ProviderRequest): Promise<ProviderResult>;
  classify(request: ProviderRequest): Promise<ProviderClassificationResult>;
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

const planningIntents = new Set<string>(PLANNING_INTENTS);
const contextSections = new Set<string>(CONTEXT_SECTIONS);

export function validateAssistantPlanning(
  value: unknown,
): AssistantPlanning | null {
  if (!isRecord(value)) return null;
  const intent = typeof value.intent === "string" ? value.intent.trim() : "";
  if (!planningIntents.has(intent)) return null;

  let sections: ContextSection[] | undefined;
  if (value.sections !== undefined) {
    if (
      !Array.isArray(value.sections) ||
      value.sections.length === 0 ||
      value.sections.length > CONTEXT_SECTIONS.length
    )
      return null;
    const seen = new Set<string>();
    sections = [];
    for (const entry of value.sections) {
      // Unknown names or duplicates fail the whole plan — the caller degrades
      // to the full-context path instead of guessing.
      if (typeof entry !== "string" || !contextSections.has(entry) || seen.has(entry)) {
        return null;
      }
      seen.add(entry);
      sections.push(entry as ContextSection);
    }
  }
  return sections ? { intent: intent as PlanningIntent, sections } : { intent: intent as PlanningIntent };
}
