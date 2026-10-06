import { WalletCards } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KpiCard } from './kpi-card';

describe('KpiCard — بطاقة مؤشر الأداء الموحدة', () => {
  it('renders label, value, and sub with the kpi data hooks', () => {
    const html = renderToStaticMarkup(
      <KpiCard label="التحصيل الشهري" value="1,250" sub="من 2,000 مستحق" icon={WalletCards} />,
    );
    expect(html).toContain('data-kpi-card');
    expect(html).toContain('التحصيل الشهري');
    expect(html).toContain('1,250');
    expect(html).toContain('من 2,000 مستحق');
    expect(html).toContain('shadow-card');
  });

  it('exposes the accent via data-accent so the palette layer can theme it', () => {
    const html = renderToStaticMarkup(<KpiCard label="x" value={1} icon={WalletCards} accent="emerald" />);
    expect(html).toContain('data-accent="emerald"');
  });

  it('shows an up trend badge with success tokens', () => {
    const html = renderToStaticMarkup(
      <KpiCard label="x" value={1} icon={WalletCards} trend="up" trendValue="محصّل" />,
    );
    expect(html).toContain('محصّل');
    expect(html).toContain('text-success bg-success/10');
  });

  it('shows a down trend badge with danger tokens', () => {
    const html = renderToStaticMarkup(
      <KpiCard label="x" value={1} icon={WalletCards} trend="down" trendValue="سالب" />,
    );
    expect(html).toContain('text-danger bg-danger/10');
  });

  it('hides the trend badge when only one of trend/trendValue is provided', () => {
    const html = renderToStaticMarkup(<KpiCard label="x" value={1} icon={WalletCards} trend="up" />);
    expect(html).not.toContain('↑');
  });

  it('keeps the numeric value in LTR for digit stability in RTL pages', () => {
    const html = renderToStaticMarkup(<KpiCard label="x" value="1,234.5" icon={WalletCards} />);
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('tabular-nums');
  });
});
