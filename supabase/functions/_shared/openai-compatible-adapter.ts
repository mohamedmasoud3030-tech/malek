import {
  AI_OUTPUT_SCHEMA_VERSION,
  AI_PLANNING_SCHEMA_VERSION,
  CONTEXT_SECTIONS,
  PLANNING_INTENTS,
  type AiProviderAdapter,
  type JsonObject,
  type ProviderClassificationResult,
  type ProviderRequest,
  type ProviderResult,
  type ProviderUsage,
  isRecord,
  validateAssistantOutput,
  validateAssistantPlanning,
} from "./ai-contract.ts";

export class ProviderAdapterError extends Error {
  constructor(
    readonly code: "NETWORK" | "HTTP" | "MALFORMED_OUTPUT",
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderAdapterError";
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function readUsage(value: JsonObject): ProviderUsage {
  if (!isRecord(value.usage)) return {};
  return {
    inputTokens:
      typeof value.usage.prompt_tokens === "number"
        ? value.usage.prompt_tokens
        : undefined,
    outputTokens:
      typeof value.usage.completion_tokens === "number"
        ? value.usage.completion_tokens
        : undefined,
  };
}

function readContent(value: JsonObject): string {
  if (!Array.isArray(value.choices) || !isRecord(value.choices[0])) return "";
  const message = value.choices[0].message;
  return isRecord(message) && typeof message.content === "string"
    ? message.content.trim()
    : "";
}

function readSafeProviderError(value: unknown): {
  code?: string;
  status?: string;
  message?: string;
} {
  if (!isRecord(value)) return {};
  const nested = isRecord(value.error) ? value.error : value;
  const rawCode = nested.code;
  const rawStatus = nested.status;
  const rawMessage = nested.message;
  return {
    code:
      typeof rawCode === "string" || typeof rawCode === "number"
        ? String(rawCode).slice(0, 80)
        : undefined,
    status:
      typeof rawStatus === "string" || typeof rawStatus === "number"
        ? String(rawStatus).slice(0, 80)
        : undefined,
    message:
      typeof rawMessage === "string"
        ? rawMessage.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED]").slice(0, 500)
        : undefined,
  };
}

type StrictSchema = Readonly<{ name: string; schema: JsonObject }>;

const ANSWER_SCHEMA: StrictSchema = {
  name: AI_OUTPUT_SCHEMA_VERSION,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["answer", "grounded", "caveats"],
    properties: {
      answer: { type: "string", minLength: 1, maxLength: 6000 },
      grounded: { type: "boolean" },
      caveats: {
        type: "array",
        maxItems: 5,
        items: { type: "string", maxLength: 500 },
      },
    },
  },
};

const PLANNING_SCHEMA: StrictSchema = {
  name: AI_PLANNING_SCHEMA_VERSION,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["intent"],
    properties: {
      intent: { type: "string", enum: [...PLANNING_INTENTS] },
      sections: {
        type: "array",
        maxItems: CONTEXT_SECTIONS.length,
        items: { type: "string", enum: [...CONTEXT_SECTIONS] },
      },
    },
  },
};

export class OpenAiCompatibleAdapter implements AiProviderAdapter {
  readonly provider = "openai-compatible";

  constructor(
    private readonly url: string,
    private readonly apiKey: string,
  ) {}

  /** Answers a request and validates the response contract. */
  async generate(request: ProviderRequest): Promise<ProviderResult> {
    const startedAt = Date.now();
    const { content, usage } = await this.completeJson(request, ANSWER_SCHEMA);
    const output = validateAssistantOutput(JSON.parse(content));
    if (!output) {
      throw new ProviderAdapterError(
        "MALFORMED_OUTPUT",
        "AI provider output failed schema validation.",
      );
    }
    return {
      output,
      durationMs: Date.now() - startedAt,
      usage,
    };
  }

  /**
   * Tiny planning call: classifies a freeform prompt into the closed intent
   * union. Same strict JSON-schema transport as answers — provider-agnostic.
   */
  async classify(
    request: ProviderRequest,
  ): Promise<ProviderClassificationResult> {
    const startedAt = Date.now();
    const { content, usage } = await this.completeJson(request, PLANNING_SCHEMA);
    const output = validateAssistantPlanning(JSON.parse(content));
    if (!output) {
      throw new ProviderAdapterError(
        "MALFORMED_OUTPUT",
        "AI provider planning output failed schema validation.",
      );
    }
    return {
      output,
      durationMs: Date.now() - startedAt,
      usage,
    };
  }

  /**
   * Shared strict-JSON transport for both provider call kinds. Never retries:
   * a failed paid call must surface to the caller, which owns the fallback.
   */
  private async completeJson(
    request: ProviderRequest,
    schema: StrictSchema,
  ): Promise<{ content: string; usage: ProviderUsage }> {
    let response: Response;
    try {
      response = await fetchWithTimeout(
        this.url,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: request.model,
            messages: request.messages,
            max_tokens: request.maxOutputTokens,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: schema.name,
                strict: true,
                schema: schema.schema,
              },
            },
          }),
        },
        request.timeoutMs,
      );
    } catch {
      throw new ProviderAdapterError(
        "NETWORK",
        "AI provider request failed before a response was received.",
      );
    }

    const body = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const diagnostic = readSafeProviderError(body);
      console.error("AI provider HTTP response", {
        status: response.status,
        providerHost: new URL(this.url).hostname,
        providerCode: diagnostic.code,
        providerStatus: diagnostic.status,
        providerMessage: diagnostic.message,
      });
      throw new ProviderAdapterError(
        "HTTP",
        "AI provider returned an unsuccessful response.",
        response.status,
      );
    }
    if (!isRecord(body))
      throw new ProviderAdapterError(
        "MALFORMED_OUTPUT",
        "AI provider returned a malformed envelope.",
      );

    return { content: readContent(body), usage: readUsage(body) };
  }
}
