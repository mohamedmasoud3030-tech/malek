import { Bot, CalendarClock, Send, Sparkles, Wallet } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Static marketing/demo capture of the AI assistant workspace — same
 * layout and chat chrome as production, with a scripted conversation.
 * Rendered only behind VITE_E2E.
 */
const assistantReply = `بناءً على ملخص يوليو حتى اليوم:

• المتأخرات الحرجة: فاتورتان بإجمالي 1,580 ر.ع. — أعلاها «شركة أفق الخليج» بواقع 1,200 ر.ع. متجاوزة 45 يوماً، ويُنصح بإرسال تذكير رسمي اليوم.
• التحصيل الشهري: 1,370 ر.ع. من 5,130 ر.ع. مستحقة (27%)، أعلى من متوسطك في نفس الفترة بـ 8%.
• عقود تنتهي خلال 45 يوماً: عقدان — الوحدة 205 في برج الواحة و B-12 في مجمع السلام. بدء التفاوض المبكر يقلل فترات الشغور.
• توصية اليوم: مراجعة تقرير أعمار الديون في مركز التقارير وتفعيل تذكير الواتساب الآلي للعقدين المتأخرين.`;

export function AiAssistantE2EFixture() {
  const [input, setInput] = useState('');

  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground" dir="rtl" data-e2e-ai-assistant-workspace>
      <PageLayout size="wide" dir="rtl" lang="ar">
        <PageHeader
          title="مساعد الذكاء الاصطناعي"
          description="مساعد تشغيلي قراءة فقط يستخدم ملخصات آمنة من بيانات MALIK المسموح لحسابك بقراءتها، ولا ينفذ أي تعديل أو SQL."
        />

        <div className="grid gap-3 md:grid-cols-3" aria-label="ملخص السياق المقروء">
          <Card variant="muted">
            <CardContent className="space-y-1 pt-6">
              <p className="text-sm font-bold text-muted-foreground">المتأخرات</p>
              <p className="text-2xl font-black" dir="ltr">1,580 ر.ع.</p>
              <p className="text-xs text-muted-foreground">فاتورتان مفتوحتان حتى 2026-07-16</p>
            </CardContent>
          </Card>
          <Card variant="muted">
            <CardContent className="space-y-1 pt-6">
              <p className="text-sm font-bold text-muted-foreground">التجديدات القادمة</p>
              <p className="text-2xl font-black">2</p>
              <p className="text-xs text-muted-foreground">خلال 45 يوماً</p>
            </CardContent>
          </Card>
          <Card variant="muted">
            <CardContent className="space-y-1 pt-6">
              <p className="text-sm font-bold text-muted-foreground">الإشغال</p>
              <p className="text-2xl font-black">80%</p>
              <p className="text-xs text-muted-foreground">12 من 15 وحدة</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bot className="size-5 text-primary" aria-hidden="true" />المحادثة</CardTitle>
              <CardDescription>اكتب سؤالاً تشغيلياً أو اختر إجراءً جاهزاً. الردود مساعدة فقط ولا تستبدل المراجعة البشرية.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[32rem] space-y-3 overflow-y-auto rounded-2xl border bg-muted/20 p-3" aria-live="polite">
                <div className="me-auto max-w-[90%] rounded-2xl border bg-card px-4 py-3 text-sm leading-7 shadow-sm">
                  <p className="whitespace-pre-wrap">أهلاً بك في مساعد MALIK. اسألني عن المتأخرات، التجديدات القادمة، أو لقطة مالية سريعة — أقرأ بياناتك بأمان ولا أنفذ أي تعديل.</p>
                </div>
                <div className="ms-auto max-w-[90%] rounded-2xl bg-primary px-4 py-3 text-sm leading-7 text-primary-foreground shadow-sm">
                  <p className="whitespace-pre-wrap">ما أهم المتأخرات التي تحتاج متابعة هذا الأسبوع؟</p>
                </div>
                <div className="me-auto max-w-[90%] rounded-2xl border bg-card px-4 py-3 text-sm leading-7 shadow-sm">
                  <p className="whitespace-pre-wrap">{assistantReply}</p>
                </div>
              </div>

              <form className="space-y-3" onSubmit={(event) => event.preventDefault()}>
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="مثال: ما أهم المتأخرات التي تحتاج متابعة هذا الأسبوع؟"
                  aria-label="رسالة مساعد الذكاء الاصطناعي"
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="submit" disabled={!input.trim()}>
                    <Send className="me-2 size-4" aria-hidden="true" />إرسال
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" aria-hidden="true" />إجراءات جاهزة</CardTitle>
              <CardDescription>كل إجراء يجمع ملخصاً آمناً ثم يطلب من الدالة الخلفية صياغة قراءة عربية.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { action: 'summarize-overdue', label: 'لخّص المتأخرات لهذا الشهر', Icon: Wallet },
                { action: 'summarize-renewals', label: 'عقود تنتهي خلال 45 يوماً', Icon: CalendarClock },
                { action: 'financial-snapshot', label: 'لقطة مالية سريعة', Icon: Sparkles },
              ].map(({ action, label, Icon }) => (
                <Button
                  key={action}
                  type="button"
                  variant="outline"
                  className={cn('h-auto w-full justify-start whitespace-normal rounded-2xl p-3 text-start')}
                >
                  <Icon className="me-2 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    </main>
  );
}
