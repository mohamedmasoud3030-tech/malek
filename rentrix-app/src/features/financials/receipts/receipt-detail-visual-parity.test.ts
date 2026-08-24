import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./receipt-detail-page.tsx', import.meta.url), 'utf8');

describe('receipt detail MALEK Pro visual parity', () => {
  it('uses the shared visual scope and a distinct printable document surface', () => {
    expect(source).toContain('visualVariant="malek-pro"');
    expect(source).toContain('print-document');
    expect(source).toContain('print:hidden');
    expect(source).toContain('bg-muted/20');
  });

  it('keeps the document actions touch-safe and print chrome excluded', () => {
    expect(source).toContain("from '@/components/ui/button'");
    expect(source).toContain('min-h-14 w-full');
    expect(source).toContain('print:hidden md:hidden');
    expect(source).toContain('print:border-0 print:shadow-none');
  });
});
