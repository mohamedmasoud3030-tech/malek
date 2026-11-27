import { supabase } from '@/lib/supabase';

/**
 * بيانات دليل البداية — تعريف الخطوات وقراءة تقدم المستخدم من قاعدة
 * البيانات. الوصول للبيانات معزول هنا (بعيد عن مكونات العرض) حسب عقد
 * معمارية المشروع.
 */

export interface FirstRunStep {
  key: 'properties' | 'units' | 'people' | 'contracts';
  label: string;
  hint: string;
  to: string;
  actionLabel: string;
  table: 'properties' | 'units' | 'people' | 'contracts';
}

export const FIRST_RUN_STEPS: readonly FirstRunStep[] = [
  {
    key: 'properties',
    label: 'أضف أول عقار',
    hint: 'ابدأ بعمارة أو عقار واحد اللي هتديره هنا.',
    to: '/properties/new',
    actionLabel: 'إضافة عقار',
    table: 'properties',
  },
  {
    key: 'units',
    label: 'أضف وحدات العقار',
    hint: 'شقق أو محلات أو مكاتب جوه العقار اللي ضفته.',
    to: '/properties',
    actionLabel: 'فتح العقارات',
    table: 'units',
  },
  {
    key: 'people',
    label: 'سجل المستأجرين والملاك',
    hint: 'أضف بيانات الناس اللي ليهم عقود على الوحدات.',
    to: '/people/new',
    actionLabel: 'إضافة شخص',
    table: 'people',
  },
  {
    key: 'contracts',
    label: 'أنشئ أول عقد',
    hint: 'اربط مستأجر بوحدة بإيجار ومدة، والباقي علينا.',
    to: '/contracts/new',
    actionLabel: 'إنشاء عقد',
    table: 'contracts',
  },
];

export type FirstRunStepCounts = Partial<Record<FirstRunStep['key'], number>>;

/**
 * عدد السجلات لكل خطوة. قراءة عدّ فقط (head queries) فلا تحمل بيانات
 * ولا تكلف شيئا يذكر، وتخضع لصلاحيات RLS الحالية للمستخدم.
 */
export async function fetchFirstRunStepCounts(): Promise<FirstRunStepCounts> {
  const entries = await Promise.all(
    FIRST_RUN_STEPS.map(async (step) => {
      const { count, error } = await supabase
        .from(step.table)
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      return [step.key, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries);
}
