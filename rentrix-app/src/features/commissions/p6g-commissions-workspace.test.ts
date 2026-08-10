import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('P6g — commissions workspace clarity (closeout)', () => {
  const view = read('./components/commissions-view.tsx');

  it('communicates source/beneficiary/amount/status and the next available action', () => {
    expect(view).toContain('المستفيد');
    expect(view).toContain('المبلغ');
    expect(view).toContain('الحالة');
    expect(view).toContain('التالي: اعتماد');
    expect(view).toContain('التالي: صرف مالي');
    expect(view).toContain('التالي: عكس الصرف');
    expect(view).toContain('لا إجراء متاح');
  });

  it('uses readable source references, never raw ids', () => {
    expect(view).toContain('formatSourceLabel');
    expect(view).toContain('من ${prefix} مرتبط');
    expect(view).not.toContain('row.source_id ??');
    expect(view).not.toContain('sourceId.slice');
  });

  it('keeps operational commissions visually and conceptually separate from owner-agreement management fees', () => {
    expect(view).toContain('توضيح المجال');
    expect(view).toContain('أتعاب إدارة الملاك الواردة في اتفاقيات التشغيل مفهوم منفصل ولا تُدمج هنا مالياً أو محاسبياً');
  });

  it('documents the lifecycle without changing GL semantics', () => {
    expect(view).toContain('دورة الحالة');
    expect(view).toContain('قيد المراجعة ← معتمدة ← مسجلة كمدفوعة');
    // No hardcoded currency and no legacy journal wording in the workspace.
    expect(view).not.toContain('unit="OMR"');
    expect(view).not.toContain('دفتر أستاذ عام');
  });

  it('keeps the mobile one-datum table mechanism on the commissions register', () => {
    expect(view).toContain('mobileVisibleSecondaryKey="amount"');
  });
});
