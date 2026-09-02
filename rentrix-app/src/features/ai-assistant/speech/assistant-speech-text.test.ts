import { describe, expect, it } from 'vitest';
import { amountToSpeechWords, buildAssistantSpeechText } from './assistant-speech-text';

describe('buildAssistantSpeechText — Markdown normalization', () => {
  it('keeps plain Arabic text intact', () => {
    expect(buildAssistantSpeechText('مرحباً! كيف يمكنني مساعدتك اليوم؟')).toBe('مرحباً! كيف يمكنني مساعدتك اليوم؟');
  });

  it('returns an empty string for empty input', () => {
    expect(buildAssistantSpeechText('')).toBe('');
  });

  it('stripes emphasis, heading and strikethrough markers', () => {
    expect(buildAssistantSpeechText('**إجمالي 10** و*ملاحظة* # عنوان ~~حذف~~')).toBe('إجمالي 10 وملاحظة عنوان حذف');
    expect(buildAssistantSpeechText('# ملخص الشهر\nإجمالي 10')).toBe('ملخص الشهر إجمالي 10');
  });

  it('keeps link text and drops URLs', () => {
    expect(buildAssistantSpeechText('راجع [التقرير](https://example.com/report) الآن')).toBe('راجع التقرير الآن');
    expect(buildAssistantSpeechText('الرابط https://example.com/secret/123 غير متاح')).toBe('الرابط  غير متاح'.replace('  ', ' '));
  });

  it('keeps image alt text', () => {
    expect(buildAssistantSpeechText('![مخطط الإشغال](https://example.com/chart.png) واضح')).toBe('مخطط الإشغال واضح');
  });

  it('joins table cells and drops separator rows', () => {
    const table = [
      '| الفاتورة | المبلغ |',
      '| --- | --- |',
      '| INV-1 | 420 ر.ع |',
    ].join('\n');
    expect(buildAssistantSpeechText(table)).toBe('الفاتورة، المبلغ INV-1، أربعمائة وعشرون ريال عماني');
  });

  it('keeps fenced code content without the fences', () => {
    expect(buildAssistantSpeechText('```sql\nSELECT 1;\n```')).toBe('SELECT 1;');
  });

  it('strips list bullets and numbered markers but keeps the content', () => {
    expect(buildAssistantSpeechText('• أول نقطة\n- ثانية\n1. ثالثة')).toBe('أول نقطة ثانية 1 ثالثة'.replace('  ', ' '));
  });

  it('removes horizontal rules and blockquote markers', () => {
    expect(buildAssistantSpeechText('---\n> ملاحظة مهمة')).toBe('ملاحظة مهمة');
  });
});

describe('buildAssistantSpeechText — OMR monetary values (3-decimal precision)', () => {
  it('speaks 12.345 ر.ع with baisa precision', () => {
    expect(buildAssistantSpeechText('الإجمالي 12.345 ر.ع.')).toBe(
      'الإجمالي اثنا عشر ريال عماني وثلاثمائة وخمسة وأربعون بيسة',
    );
  });

  it('speaks grouped amounts without decimals', () => {
    expect(buildAssistantSpeechText('إجمالي 1,580 ر.ع')).toBe('إجمالي ألف وخمسمائة وثمانون ريال عماني');
  });

  it('drops the sub-unit when the fraction is zero', () => {
    expect(buildAssistantSpeechText('441.000 ر.ع.')).toBe('أربعمائة وواحد وأربعون ريال عماني');
  });

  it('scales short fractions to baisa (2.5 = 500 بيسة)', () => {
    expect(buildAssistantSpeechText('2.5 ر.ع')).toBe('اثنان ريال عماني وخمسمائة بيسة');
  });

  it('speaks sub-riyal amounts as baisa only', () => {
    expect(buildAssistantSpeechText('0.500 ر.ع')).toBe('خمسمائة بيسة');
  });

  it('handles the marker-before-number order', () => {
    expect(buildAssistantSpeechText('ر.ع 12.345')).toBe('اثنا عشر ريال عماني وثلاثمائة وخمسة وأربعون بيسة');
  });

  it('handles the spelled-out Omani riyal marker', () => {
    expect(buildAssistantSpeechText('إجمالي 100 ريال عماني')).toBe('إجمالي مائة ريال عماني');
  });

  it('handles the OMR code prefix', () => {
    expect(buildAssistantSpeechText('OMR 250.250')).toBe('مائتان وخمسون ريال عماني ومائتان وخمسون بيسة');
  });

  it('handles Arabic-Indic digits', () => {
    expect(buildAssistantSpeechText('١٢.٣٤٥ ر.ع')).toBe('اثنا عشر ريال عماني وثلاثمائة وخمسة وأربعون بيسة');
  });

  it('speaks negative amounts as سالب', () => {
    expect(buildAssistantSpeechText('-45.200 ر.ع')).toBe('سالب خمسة وأربعون ريال عماني ومائتان بيسة');
  });

  it('does not treat out-of-precision decimals as OMR (stays readable)', () => {
    const result = buildAssistantSpeechText('قيمة 1.2345 ر.ع غير متوقعة');
    expect(result).toContain('1.2345 ر.ع');
  });
});

describe('amountToSpeechWords — other currencies use their own sub-unit', () => {
  it('AED uses fils at 2dp scale', () => {
    expect(amountToSpeechWords('441.500', 'AED')).toBe('أربعمائة وواحد وأربعون درهم إماراتي وخمسون فلس');
  });

  it('USD uses cents', () => {
    expect(amountToSpeechWords('10.50', 'USD')).toBe('عشرة دولار أمريكي وخمسون سنت');
  });
});

describe('buildAssistantSpeechText — percentages and dates', () => {
  it('speaks integer percentages', () => {
    expect(buildAssistantSpeechText('نسبة الإشغال 75%')).toBe('نسبة الإشغال خمسة وسبعون بالمئة');
  });

  it('speaks the Arabic percent sign with decimals', () => {
    expect(buildAssistantSpeechText('75.5٪')).toBe('خمسة وسبعون وخمسون بالمئة');
    expect(buildAssistantSpeechText('نسبة النمو 27 ٪')).toBe('نسبة النمو سبعة وعشرون بالمئة');
  });

  it('speaks ISO dates with Arabic month names', () => {
    expect(buildAssistantSpeechText('أقدم تاريخ استحقاق هو 2026-06-01.')).toBe('أقدم تاريخ استحقاق هو 1 يونيو 2026.');
  });

  it('speaks dotted dates day-first', () => {
    expect(buildAssistantSpeechText('من 01/08/2026 إلى 31/08/2026')).toBe('من 1 أغسطس 2026 إلى 31 أغسطس 2026');
  });

  it('speaks plain decimals as word ونقطة digits', () => {
    expect(buildAssistantSpeechText('الفرق 3.141')).toBe('الفرق ثلاثة ونقطة واحد وأربعة وواحد');
  });
});

describe('buildAssistantSpeechText — realistic assistant responses', () => {
  it('normalizes the overdue-invoices deterministic reply end to end', () => {
    const reply = 'يوجد 2 فاتورة متأخرة بإجمالي متبقٍ 640.000 ر.ع، وأقدم تاريخ استحقاق هو 2026-06-01. ابدأ بالأقدم.';
    expect(buildAssistantSpeechText(reply)).toBe(
      'يوجد 2 فاتورة متأخرة بإجمالي متبقٍ ستمائة وأربعون ريال عماني، وأقدم تاريخ استحقاق هو 1 يونيو 2026. ابدأ بالأقدم.',
    );
  });

  it('never lets Markdown tokens or raw currency symbols reach the output', () => {
    const reply =
      '## ملخص الشهر\n- **الإيجار**: 1,370.500 ر.ع.\n- التحصيل: 27.5% من [الإجمالي](https://malek.om/rep).\n| م | مبلغ |\n| - | - |\n| يوليو | 45.000 ر.ع |';
    const spoken = buildAssistantSpeechText(reply);
    expect(spoken).not.toMatch(/[#*|`_~]/);
    expect(spoken).not.toContain('https://');
    expect(spoken).not.toContain('ر.ع');
    expect(spoken).toContain('ألف وثلاثمائة وسبعون ريال عماني وخمسمائة بيسة');
    expect(spoken).toContain('خمسة وأربعون ريال عماني');
    expect(spoken).toContain('سبعة وعشرون وخمسون بالمئة');
  });
});
