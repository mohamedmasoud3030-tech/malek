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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function errorResponse(code: string, message: string, status: number): Response {
  return jsonResponse({ error: { code, message } }, status);
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

async function assertAuthenticated(request: Request): Promise<Response | null> {
  const authHeader = request.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return errorResponse('AUTH_REQUIRED', 'يجب تسجيل الدخول لاستخدام مساعد الذكاء الاصطناعي.', 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse('SUPABASE_CONFIG_MISSING', 'إعدادات Supabase غير مكتملة للدالة الخلفية.', 500);
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: authHeader,
    },
  });

  if (!userResponse.ok) {
    return errorResponse('AUTH_REQUIRED', 'انتهت الجلسة أو لا تملك صلاحية استخدام المساعد.', 401);
  }

  return null;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'طريقة الطلب غير مدعومة.', 405);

  const authError = await assertAuthenticated(request);
  if (authError) return authError;

  const apiKey = Deno.env.get('AI_PROVIDER_API_KEY')?.trim();
  if (!apiKey) {
    return errorResponse('AI_CONFIG_MISSING', 'إعدادات الذكاء الاصطناعي غير مكتملة', 503);
  }

  const providerUrlResult = readProviderUrl();
  if ('error' in providerUrlResult) return providerUrlResult.error;

  const body = await readJsonBody(request);
  if (!isRecord(body)) return errorResponse('INVALID_REQUEST', 'صيغة الطلب غير صحيحة.', 400);

  const prompt = readString(body.prompt, 2400);
  const action = readString(body.action, 120) || 'freeform';
  if (!prompt) return errorResponse('VALIDATION_ERROR', 'اكتب سؤالاً أو اختر إجراءً جاهزاً.', 422);
  if (sqlStatementPattern.test(prompt)) {
    return errorResponse('SQL_NOT_ACCEPTED', 'لا يقبل المساعد أوامر SQL ولا ينفذ استعلامات مباشرة.', 422);
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
      ].join('\n'),
    },
    ...history,
    {
      role: 'user',
      content: [`الإجراء المطلوب: ${action}`, `طلب المستخدم: ${prompt}`, 'السياق المتاح قراءة فقط:', context].join('\n\n'),
    },
  ];

  const providerResponse = await fetch(providerUrlResult.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 900 }),
  });

  const providerBody = readProviderResponse(await providerResponse.json().catch(() => null));
  if (!providerResponse.ok) {
    console.error('AI provider request failed', { status: providerResponse.status, message: providerBody.error?.message });
    return errorResponse('AI_PROVIDER_ERROR', 'تعذر الحصول على رد من مزود الذكاء الاصطناعي.', 502);
  }

  const reply = providerBody.choices?.[0]?.message?.content?.trim();
  if (!reply) return errorResponse('AI_EMPTY_RESPONSE', 'عاد مزود الذكاء الاصطناعي برد فارغ.', 502);

  return jsonResponse({ reply });
});
