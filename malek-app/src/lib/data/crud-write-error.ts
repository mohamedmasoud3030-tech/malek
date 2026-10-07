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
    return `${fallback}: لا تملك صلاحية تنفيذ هذا الإجراء. تواصل مع المسؤول إذا كنت تحتاج هذه الصلاحية.`;
  }

  if (lowerMessage.includes('duplicate key') || lowerMessage.includes('unique constraint') || lowerMessage.includes('already exists')) {
    return `${fallback}: توجد بيانات مماثلة مسجلة بالفعل. راجع البيانات ثم أعد المحاولة.`;
  }

  if (lowerMessage.includes('foreign key') || lowerMessage.includes('violates foreign key')) {
    return `${fallback}: لا يمكن تنفيذ الإجراء لارتباط السجل ببيانات أخرى.`;
  }

  if (lowerMessage.includes('check constraint') || lowerMessage.includes('invalid input') || lowerMessage.includes('violates check')) {
    return `${fallback}: بعض البيانات غير صالحة. راجع الحقول المطلوبة ثم أعد المحاولة.`;
  }

  if (lowerMessage.includes('failed to fetch') || lowerMessage.includes('network') || lowerMessage.includes('econn')) {
    return `${fallback}: تعذر الاتصال بالخادم. تحقق من الشبكة ثم أعد المحاولة.`;
  }

  return `${fallback}. أعد المحاولة، وإذا استمرت المشكلة تواصل مع مسؤول النظام.`;
}
