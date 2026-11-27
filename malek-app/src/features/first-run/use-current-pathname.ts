import { useLocation } from '@tanstack/react-router';

/**
 * مسار الصفحة الحالية بشكل يتحمل اختلاف بيئات التشغيل: الراوتر الحقيقي يطبق
 * الـ selector ويرجع نصا، بينما بدائل الاختبار القديمة في المشروع ترجع كائن
 * الـ location كاملا. الدالتان مدعومتان هنا حتى لا تنكسر اختبارات الـ shell
 * الموجودة.
 */
export function useCurrentPathname(): string {
  const selected = useLocation({ select: (location) => location.pathname });
  if (typeof selected === 'string') return selected;
  return (selected as { pathname?: string } | null | undefined)?.pathname ?? '';
}
