import type { PostgrestError } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export type DiagnosticCode =
  | 'missing_supabase_url'
  | 'missing_supabase_anon_key'
  | 'placeholder_supabase_config'
  | 'supabase_connection_failure'
  | 'missing_required_table'
  | 'missing_required_rpc';

export type RuntimeDiagnostic = {
  code: DiagnosticCode;
  messageAr: string;
  technical: string;
};

/**
 * Fail-closed environment diagnostics for first-visit and data-error surfaces.
 *
 * Missing values and known placeholder/CI values are both treated as
 * "not configured" so the login form does not invite a network attempt that
 * can only fail opaquely.
 */
export function getEnvDiagnostics(): RuntimeDiagnostic[] {
  const diagnostics: RuntimeDiagnostic[] = [];
  const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
  const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

  if (!rawUrl) {
    diagnostics.push({
      code: 'missing_supabase_url',
      messageAr: 'إعداد الاتصال بقاعدة البيانات غير مكتمل.',
      technical: 'Missing VITE_SUPABASE_URL in current Vite runtime environment.',
    });
  }

  if (!rawKey) {
    diagnostics.push({
      code: 'missing_supabase_anon_key',
      messageAr: 'إعداد الوصول إلى قاعدة البيانات غير مكتمل.',
      technical: 'Missing VITE_SUPABASE_ANON_KEY in current Vite runtime environment.',
    });
  }

  // Placeholder or otherwise invalid public config: env.isConfigured is the
  // single runtime authority shared with the Supabase client boundary.
  if ((rawUrl || rawKey) && !env.isConfigured) {
    diagnostics.push({
      code: 'placeholder_supabase_config',
      messageAr: 'إعداد الاتصال بالخادم غير جاهز حالياً. تواصل مع مسؤول النظام لإكمال التهيئة.',
      technical:
        'VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are missing, placeholder, or otherwise not production-usable.',
    });
  }

  return diagnostics;
}

export function parseSupabaseDiagnostics(error: unknown): RuntimeDiagnostic[] {
  if (!error) return [];
  const diagnostics: RuntimeDiagnostic[] = [];
  const maybe = error as Partial<PostgrestError> & { message?: string; details?: string; hint?: string; code?: string };
  const text = `${maybe.message ?? ''} ${maybe.details ?? ''}`.toLowerCase();

  if (text.includes('failed to fetch') || text.includes('network') || maybe.code === 'ECONNREFUSED') {
    diagnostics.push({
      code: 'supabase_connection_failure',
      messageAr: 'تعذر الاتصال بقاعدة البيانات. تحقق من الشبكة ثم أعد المحاولة.',
      technical: `Supabase connectivity error: ${maybe.message ?? 'Unknown error'}`,
    });
  }

  if (text.includes('does not exist') && text.includes('relation')) {
    diagnostics.push({
      code: 'missing_required_table',
      messageAr: 'يوجد جدول مطلوب غير موجود في قاعدة البيانات الحالية.',
      technical: `Missing relation/table detected: ${maybe.message ?? 'Unknown relation error'}`,
    });
  }

  if (text.includes('function') && text.includes('does not exist')) {
    diagnostics.push({
      code: 'missing_required_rpc',
      messageAr: 'تعذر إكمال العملية لأن إعداداً مطلوباً غير متاح حالياً.',
      technical: `Missing RPC function detected: ${maybe.message ?? 'Unknown RPC error'}`,
    });
  }

  if (diagnostics.length === 0) {
    diagnostics.push({
      code: 'supabase_connection_failure',
      messageAr: 'حدث خطأ أثناء تحميل البيانات.',
      technical: `Unhandled Supabase error: ${maybe.message ?? 'Unknown error'}`,
    });
  }

  return diagnostics;
}
