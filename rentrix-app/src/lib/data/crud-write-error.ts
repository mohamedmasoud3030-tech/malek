export type CrudWriteAction = 'create' | 'update' | 'archive';

type CrudWriteErrorOptions = Readonly<{
  action: CrudWriteAction;
  entityPlural: string;
  error: unknown;
}>;

const fallbackByAction: Record<CrudWriteAction, string> = {
  create: 'تعذر إنشاء',
  update: 'تعذر تحديث',
  archive: 'تعذر أرشفة',
};

export function getCrudWriteErrorMessage({ action, entityPlural, error }: CrudWriteErrorOptions): string {
  const fallback = `${fallbackByAction[action]} ${entityPlural}`;
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('permission denied') || lowerMessage.includes('rls') || lowerMessage.includes('row-level security') || lowerMessage.includes('not authorized')) {
    return `${fallback}: لا تملك صلاحية الكتابة على ${entityPlural}. تواصل مع المسؤول أو استخدم حساباً بصلاحيات أعلى.`;
  }

  return message ? `${fallback}: ${message}` : fallback;
}
