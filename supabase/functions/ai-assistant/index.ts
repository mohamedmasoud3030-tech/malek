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

type ProviderUrlResult = {
  url: string;
} | {
  error: Response;
};

const defaultProviderUrl = 'https://api.openai.com/v1/chat/completions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const sqlStatementPattern = /\b(select|insert|update|delete|drop|alter|truncate|create|grant|revoke)\b[\s\S]*(\bfrom\b|\binto\b|\btable\b|\bset\b|;)/i;
const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

// NOTE: In-memory Map is NOT production-grade for multi-instance Edge Functions.
// For production completeness, rate limiting should use centralized storage:
// - Supabase table `ai_rate_limits` with user_id, count, window_start
// - Or Redis/KV via Upstash
// This in-memory implementation is suitable for single-instance and for graceful 503 fallback.
// TODO: Replace with Supabase table for distributed enforcement when feature is announced as complete.
const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function secureHashUserId(userId: string): string {
  // Use full user_id as key, not partial JWT. If needed, hash with SHA-256 for privacy.
  // Here we use direct user_id because it's already unique and not similar across users.
  return `user:${userId}`;
}

function checkRateLimitForUser(userId: string): { allowed: boolean; retryAfter?: number } {
  const id = secureHashUserId(userId);
  const now = Date.now();
  const entry = rateLimiter.get(id);

  if (!entry || now > entry.resetAt) {
    rateLimiter.set(id, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count += 1;
  rateLimiter.set(id, entry);
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

function readHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];

  const messages: ChatMessage[] = [];
  for (const entry of value.slice(-6)) {
    if (!isRecord(entry)) continue;
    const role = entry.role === 'assistant' ? 'assistant' : entry.role === 'user' ? 'user' : null;
    const content = readString(entry.content, 1200);
    if (role && content) messages.push({ role, content });
  }

  return messages;
}

function readProviderResponse(value: unknown): ProviderResponse {
  if (!isRecord(value)) return {};
  const choices = Array.isArray(value.choices)
    ? value.choices.filter(isRecord).map((choice) => ({
        message: isRecord(choice.message) && typeof choice.message.content === 'string'
          ? { content: choice.message.content }
          : undefined,
      }))
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

type AuthSuccess = { userId: string; email?: string };

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
    headers: {
      apikey: supabaseAnonKey,
      Authorization: authHeader,
    },
  });

  if (!userResponse.ok) {
    return { error: errorResponse('AUTH_REQUIRED', 'انتهت الجلسة أو لا تملك صلاحية استخدام المساعد.', 401) };
  }

  const userData = await userResponse.json().catch(() => null) as any;
  if (!userData?.id) {
    return { error: errorResponse('AUTH_REQUIRED', 'تعذر التحقق من هوية المستخدم.', 401) };
  }

  return { user: { userId: userData.id as string, email: userData.email as string | undefined } };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'طريقة الطلب غير مدعومة.', 405);

  // 1. Authenticate FIRST - extract user id securely
  const authResult = await assertAuthenticated(request);
  if ('error' in authResult) return authResult.error;

  const { userId } = authResult.user;

  // 2. Rate limit AFTER successful authentication, using secure user_id (not partial JWT)
  const rateLimit = checkRateLimitForUser(userId);
  if (!rateLimit.allowed) {
    return errorResponse('RATE_LIMIT_EXCEEDED', `تم تجاوز الحد المسموح للطلبات. حاول مرة أخرى بعد ${rateLimit.retryAfter || 60} ثانية.`, 429, {
      'Retry-After': String(rateLimit.retryAfter || 60),
    });
  }

  const apiKey = Deno.env.get('AI_PROVIDER_API_KEY')?.trim();
  if (!apiKey) {
    return errorResponse('AI_CONFIG_MISSING', 'إعدادات الذكاء الاصطناعي غير مكتملة. اضبط AI_PROVIDER_API_KEY في إعدادات Edge Function.', 503);
  }

  const providerUrlResult = readProviderUrl();
  if ('error' in providerUrlResult) return providerUrlResult.error;

  const body = await readJsonBody(request);
  if (!isRecord(body)) return errorResponse('INVALID_REQUEST', 'صيغة الطلب غير صحيحة.', 400);

  const prompt = readString(body.prompt, 2400);
  const action = readString(body.action, 120) || 'freeform';
  if (!prompt) return errorResponse('VALIDATION_ERROR', 'اكتب سؤالاً أو اختر إجراءً جاهزاً.', 422);
  if (prompt.length < 3) return errorResponse('VALIDATION_ERROR', 'الطلب قصير جداً.', 422);
  if (sqlStatementPattern.test(prompt)) {
    return errorResponse('SQL_NOT_ACCEPTED', 'لا يقبل المساعد أوامر SQL ولا ينفذ استعلامات مباشرة.', 422);
  }

  const lowerPrompt = prompt.toLowerCase();
  if (lowerPrompt.includes('api_key') || lowerPrompt.includes('secret') || lowerPrompt.includes('password') || lowerPrompt.includes('env')) {
    console.log('Potential secret-seeking prompt detected, proceeding with safe system instructions', { userId: userId.slice(0, 8) + '...' });
  }

  const context = stringifyForPrompt(body.context, 9000);
  const history = readHistory(body.history);
  const model = Deno.env.get('AI_PROVIDER_MODEL')?.trim() || 'gpt-4o-mini';

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: [
        'أنت مساعد تشغيلي عربي لنظام إدارة عقارية اسمه Rentrix.',
        'أنت مساعد قراءة فقط: لا تنفذ تعديلات، لا ترسل رسائل، لا تنشئ سجلات، لا تنفذ SQL، ولا تقترح تجاوز صلاحيات RLS.',
        'استخدم السياق الملخص المرسل فقط. إذا كان السياق غير كافٍ، اذكر ذلك بوضوح بدلاً من اختلاق بيانات.',
        'قدّم رداً عملياً ومختصراً بالعربية، وميّز بين الحقائق المستندة للسياق والتوصيات التشغيلية.',
        'لا تكشف أبداً عن مفاتيح API، كلمات مرور، أو إعدادات البيئة. إذا طُلب منك ذلك، اعتذر وقل أنك لا تملك صلاحية.',
        'إذا كان السياق يحتوي على بيانات حساسة، لا تعيد نشرها كاملة، فقط لخص.',
      ].join('\n'),
    },
    ...history,
    {
      role: 'user',
      content: [`الإجراء المطلوب: ${action}`, `طلب المستخدم: ${prompt}`, 'السياق المتاح قراءة فقط:', context].join('\n\n'),
    },
  ];

  const startTime = Date.now();
  let providerResponse: Response;
  try {
    providerResponse = await fetch(providerUrlResult.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 900 }),
    });
  } catch (e) {
    console.error('AI provider network error', { error: e instanceof Error ? e.message : String(e), userId: userId.slice(0, 8) });
    return errorResponse('AI_PROVIDER_NETWORK_ERROR', 'تعذر الاتصال بمزود الذكاء الاصطناعي. تحقق من الشبكة والإعدادات.', 502);
  }

  const providerBody = readProviderResponse(await providerResponse.json().catch(() => null));
  const durationMs = Date.now() - startTime;

  if (!providerResponse.ok) {
    console.error('AI provider request failed', { status: providerResponse.status, message: providerBody.error?.message, durationMs, model, userId: userId.slice(0, 8) });
    return errorResponse('AI_PROVIDER_ERROR', 'تعذر الحصول على رد من مزود الذكاء الاصطناعي.', 502);
  }

  const reply = providerBody.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    console.error('AI provider empty response', { durationMs, model, userId: userId.slice(0, 8) });
    return errorResponse('AI_EMPTY_RESPONSE', 'عاد مزود الذكاء الاصطناعي برد فارغ.', 502);
  }

  console.log('AI request success', { model, promptLength: prompt.length, contextLength: context.length, replyLength: reply.length, durationMs, action, userId: userId.slice(0, 8) + '...' });

  return jsonResponse({ reply, meta: { model, durationMs } });
});
