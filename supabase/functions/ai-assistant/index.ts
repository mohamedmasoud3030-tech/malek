type JsonObject = Record<string, unknown>;

type ChatRole = 'system' | 'user' | 'assistant';

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ProviderChoice = {
  message?: {
    content?: string;
  };
};

type ProviderResponse = {
  choices?: ProviderChoice[];
  error?: {
    message?: string;
  };
};

type ProviderUrlResult = { url: string } | { error: Response };
type AuthSuccess = { userId: string; email?: string };
type ValidatedAssistantRequest = {
  prompt: string;
  action: string;
  context: string;
  history: ChatMessage[];
};

const defaultProviderUrl = 'https://api.openai.com/v1/chat/completions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const sqlStatementPattern = /\b(select|insert|update|delete|drop|alter|truncate|create|grant|revoke)\b[\s\S]*(\bfrom\b|\binto\b|\btable\b|\bset\b|;)/i;
const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const secretSeekingTerms = ['api_key', 'secret', 'password', 'env'];

// In-memory limiting is a defensive fallback only. Production distributed
// enforcement should use a shared Supabase/Redis store.
const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimitForUser(userId: string): { allowed: boolean; retryAfter?: number } {
  const key = `user:${userId}`;
  const now = Date.now();
  const entry = rateLimiter.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimiter.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  rateLimiter.set(key, entry);
  return { allowed: true };
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

function errorResponse(code: string, message: string, status: number, extraHeaders: Record<string, string> = {}): Response {
  return jsonResponse({ error: { code, message } }, status, extraHeaders);
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function stringifyForPrompt(value: unknown, maxLength: number): string {
  try {
    return JSON.stringify(value, null, 2).slice(0, maxLength);
  } catch {
    return '{}';
  }
}

function readRole(value: unknown): ChatRole | null {
  if (value === 'assistant') return 'assistant';
  if (value === 'user') return 'user';
  return null;
}

function readHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];

  const messages: ChatMessage[] = [];
  for (const entry of value.slice(-6)) {
    if (!isRecord(entry)) continue;
    const role = readRole(entry.role);
    const content = readString(entry.content, 1200);
    if (role && content) messages.push({ role, content });
  }
  return messages;
}

function readProviderResponse(value: unknown): ProviderResponse {
  if (!isRecord(value)) return {};

  const choices = Array.isArray(value.choices)
    ? value.choices.filter(isRecord).map((choice) => {
        const message = isRecord(choice.message) && typeof choice.message.content === 'string'
          ? { content: choice.message.content }
          : undefined;
        return { message };
      })
    : undefined;

  const error = isRecord(value.error) && typeof value.error.message === 'string'
    ? { message: value.error.message }
    : undefined;

  return { choices, error };
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json() as unknown;
  } catch {
    return null;
  }
}

function isPrivateIpv4(hostname: string): boolean {
  const match = hostname.match(ipv4Pattern);
  if (!match) return false;

  const octets = match.slice(1).map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) return true;

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '::1' ||
    normalized === '[::1]' ||
    normalized === '0.0.0.0' ||
    isPrivateIpv4(normalized)
  );
}

function readProviderUrl(): ProviderUrlResult {
  const rawProviderUrl = Deno.env.get('AI_PROVIDER_BASE_URL')?.trim() || defaultProviderUrl;
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawProviderUrl);
  } catch {
    return { error: errorResponse('AI_PROVIDER_URL_INVALID', 'إعدادات مزود الذكاء الاصطناعي غير صحيحة.', 500) };
  }

  if (
    parsedUrl.protocol !== 'https:' ||
    parsedUrl.username !== '' ||
    parsedUrl.password !== '' ||
    parsedUrl.hash !== '' ||
    isPrivateHostname(parsedUrl.hostname)
  ) {
    return { error: errorResponse('AI_PROVIDER_URL_INVALID', 'إعدادات مزود الذكاء الاصطناعي غير صحيحة.', 500) };
  }

  return { url: parsedUrl.toString() };
}

async function assertAuthenticated(request: Request): Promise<{ error: Response } | { user: AuthSuccess }> {
  const authHeader = request.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return { error: errorResponse('AUTH_REQUIRED', 'يجب تسجيل الدخول لاستخدام مساعد الذكاء الاصطناعي.', 401) };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: errorResponse('SUPABASE_CONFIG_MISSING', 'إعدادات Supabase غير مكتملة للدالة الخلفية.', 500) };
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnonKey, Authorization: authHeader },
  });
  if (!userResponse.ok) {
    return { error: errorResponse('AUTH_REQUIRED', 'انتهت الجلسة أو لا تملك صلاحية استخدام المساعد.', 401) };
  }

  const userData = await userResponse.json().catch(() => null) as JsonObject | null;
  if (!userData || typeof userData.id !== 'string') {
    return { error: errorResponse('AUTH_REQUIRED', 'تعذر التحقق من هوية المستخدم.', 401) };
  }

  const email = typeof userData.email === 'string' ? userData.email : undefined;
  return { user: { userId: userData.id, email } };
}

function validateAssistantRequest(body: unknown): { error: Response } | { value: ValidatedAssistantRequest } {
  if (!isRecord(body)) {
    return { error: errorResponse('INVALID_REQUEST', 'صيغة الطلب غير صحيحة.', 400) };
  }

  const prompt = readString(body.prompt, 2400);
  const action = readString(body.action, 120) || 'freeform';
  if (!prompt) {
    return { error: errorResponse('VALIDATION_ERROR', 'اكتب سؤالاً أو اختر إجراءً جاهزاً.', 422) };
  }
  if (prompt.length < 3) {
    return { error: errorResponse('VALIDATION_ERROR', 'الطلب قصير جداً.', 422) };
  }
  if (sqlStatementPattern.test(prompt)) {
    return { error: errorResponse('SQL_NOT_ACCEPTED', 'لا يقبل المساعد أوامر SQL ولا ينفذ استعلامات مباشرة.', 422) };
  }

  return {
    value: {
      prompt,
      action,
      context: stringifyForPrompt(body.context, 9000),
      history: readHistory(body.history),
    },
  };
}

function buildMessages(request: ValidatedAssistantRequest): ChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        'أنت مساعد تشغيلي عربي لنظام إدارة عقارية اسمه Rentrix.',
        'أنت مساعد قراءة فقط: لا تنفذ تعديلات، لا ترسل رسائل، لا تنشئ سجلات، لا تنفذ SQL، ولا تقترح تجاوز صلاحيات RLS.',
        'استخدم السياق الملخص المرسل فقط. إذا كان السياق غير كافٍ، اذكر ذلك بوضوح بدلاً من اختلاق بيانات.',
        'قدّم رداً عملياً ومختصراً بالعربية، وميّز بين الحقائق المستندة للسياق والتوصيات التشغيلية.',
        'لا تكشف أبداً عن مفاتيح API، كلمات مرور، أو إعدادات البيئة.',
        'إذا كان السياق يحتوي على بيانات حساسة، لا تعيد نشرها كاملة، فقط لخص.',
      ].join('\n'),
    },
    ...request.history,
    {
      role: 'user',
      content: [
        `الإجراء المطلوب: ${request.action}`,
        `طلب المستخدم: ${request.prompt}`,
        'السياق المتاح قراءة فقط:',
        request.context,
      ].join('\n\n'),
    },
  ];
}

async function requestProvider(
  providerUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  userId: string,
): Promise<{ error: Response } | { reply: string; durationMs: number }> {
  const startedAt = Date.now();
  let providerResponse: Response;

  try {
    providerResponse = await fetch(providerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 900 }),
    });
  } catch (error) {
    console.error('AI provider network error', {
      error: error instanceof Error ? error.message : String(error),
      userId: userId.slice(0, 8),
    });
    return { error: errorResponse('AI_PROVIDER_NETWORK_ERROR', 'تعذر الاتصال بمزود الذكاء الاصطناعي. تحقق من الشبكة والإعدادات.', 502) };
  }

  const providerBody = readProviderResponse(await providerResponse.json().catch(() => null));
  const durationMs = Date.now() - startedAt;
  if (!providerResponse.ok) {
    console.error('AI provider request failed', {
      status: providerResponse.status,
      message: providerBody.error?.message,
      durationMs,
      model,
      userId: userId.slice(0, 8),
    });
    return { error: errorResponse('AI_PROVIDER_ERROR', 'تعذر الحصول على رد من مزود الذكاء الاصطناعي.', 502) };
  }

  const reply = providerBody.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    console.error('AI provider empty response', { durationMs, model, userId: userId.slice(0, 8) });
    return { error: errorResponse('AI_EMPTY_RESPONSE', 'عاد مزود الذكاء الاصطناعي برد فارغ.', 502) };
  }

  return { reply, durationMs };
}

async function handlePostRequest(request: Request): Promise<Response> {
  const authResult = await assertAuthenticated(request);
  if ('error' in authResult) return authResult.error;

  const { userId } = authResult.user;
  const rateLimit = checkRateLimitForUser(userId);
  if (!rateLimit.allowed) {
    const retryAfter = rateLimit.retryAfter ?? 60;
    return errorResponse(
      'RATE_LIMIT_EXCEEDED',
      `تم تجاوز الحد المسموح للطلبات. حاول مرة أخرى بعد ${retryAfter} ثانية.`,
      429,
      { 'Retry-After': String(retryAfter) },
    );
  }

  const apiKey = Deno.env.get('AI_PROVIDER_API_KEY')?.trim();
  if (!apiKey) {
    return errorResponse('AI_CONFIG_MISSING', 'إعدادات الذكاء الاصطناعي غير مكتملة. اضبط AI_PROVIDER_API_KEY في إعدادات Edge Function.', 503);
  }

  const providerUrlResult = readProviderUrl();
  if ('error' in providerUrlResult) return providerUrlResult.error;

  const validation = validateAssistantRequest(await readJsonBody(request));
  if ('error' in validation) return validation.error;

  const assistantRequest = validation.value;
  const normalizedPrompt = assistantRequest.prompt.toLowerCase();
  if (secretSeekingTerms.some((term) => normalizedPrompt.includes(term))) {
    console.log('Potential secret-seeking prompt detected', { userId: `${userId.slice(0, 8)}...` });
  }

  const model = Deno.env.get('AI_PROVIDER_MODEL')?.trim() || 'gpt-4o-mini';
  const providerResult = await requestProvider(
    providerUrlResult.url,
    apiKey,
    model,
    buildMessages(assistantRequest),
    userId,
  );
  if ('error' in providerResult) return providerResult.error;

  console.log('AI request success', {
    model,
    promptLength: assistantRequest.prompt.length,
    contextLength: assistantRequest.context.length,
    replyLength: providerResult.reply.length,
    durationMs: providerResult.durationMs,
    action: assistantRequest.action,
    userId: `${userId.slice(0, 8)}...`,
  });

  return jsonResponse({
    reply: providerResult.reply,
    meta: { model, durationMs: providerResult.durationMs },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'طريقة الطلب غير مدعومة.', 405);
  }
  return handlePostRequest(request);
});
