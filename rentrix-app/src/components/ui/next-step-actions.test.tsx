// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { NextStepActions, type NextStepActionItem } from './next-step-actions';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

let mockRole: string = 'MANAGER';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    authorization: {
      userId: 'user-1',
      email: 'user@example.com',
      role: mockRole,
    },
  }),
}));

const sampleActions: NextStepActionItem[] = [
  {
    id: 'add-property',
    label: 'إضافة عقار لهذا المالك',
    description: 'إنشاء عقار جديد وربطه بالمالك',
    to: '/properties/new',
    permission: 'properties.write',
  },
  {
    id: 'add-units',
    label: 'إضافة وحدات عقارية',
    description: 'تسجيل الشقق أو المكاتب التابعة للعقار',
    to: '/units',
    permission: 'properties.write',
  },
  {
    id: 'create-contract',
    label: 'إنشاء عقد إيجار',
    description: 'ربط الوحدة والمستأجر بعقد تشغيلي',
    to: '/contracts/new',
    permission: 'contracts.write',
  },
  {
    id: 'review-invoices',
    label: 'مراجعة جدول الفواتير',
    description: 'عرض الفواتير المجدولة للعقد',
    to: '/invoices',
    permission: 'financial.invoices.generate',
  },
  {
    id: 'view-receipt',
    label: 'عرض سند القبض',
    description: 'طباعة ومراجعة إيصال القبض',
    to: '/receipts',
    permission: 'financial.payments.create',
  },
  {
    id: 'bank-reconcile',
    label: 'مطابقة البنوك',
    description: 'مطابقة السند مع كشف البنك',
    to: '/finance/banking',
    permission: 'financial.bank_reconciliation.view',
  },
  {
    id: 'create-settlement',
    label: 'إعداد تسوية مالك',
    description: 'صرف مستحقات المالك بعد إغلاق الشهر',
    to: '/owner-settlements',
    permission: 'financial.owner_settlements.view',
  },
];

describe('NextStepActions component contract', () => {
  beforeEach(() => {
    mockRole = 'MANAGER';
  });

  it('renders all recommended workflow next steps for authorized users', () => {
    const html = renderToStaticMarkup(<NextStepActions actions={sampleActions} />);

    expect(html).toContain('الخطوة التالية الموصى بها');
    expect(html).toContain('إضافة عقار لهذا المالك');
    expect(html).toContain('إضافة وحدات عقارية');
    expect(html).toContain('إنشاء عقد إيجار');
    expect(html).toContain('مراجعة جدول الفواتير');
    expect(html).toContain('عرض سند القبض');
    expect(html).toContain('مطابقة البنوك');
    expect(html).toContain('إعداد تسوية مالك');
  });

  it('filters out actions where the user lacks permission and renders null when no actions are visible', () => {
    mockRole = 'USER';
    const restrictedActions: NextStepActionItem[] = [
      {
        id: 'admin-action',
        label: 'إعدادات النظام',
        to: '/settings',
        permission: 'settings.manage',
      },
    ];

    const html = renderToStaticMarkup(<NextStepActions actions={restrictedActions} />);

    expect(html).toBe('');
  });
});
