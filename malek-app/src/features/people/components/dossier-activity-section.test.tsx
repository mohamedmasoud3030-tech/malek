// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DossierActivitySection } from './dossier-activity-section';

afterEach(cleanup);

describe('DossierActivitySection', () => {
  it('renders shared activity content using the caller’s date format and heading identity', () => {
    render(
      <DossierActivitySection
        headingId="tenant-activity-heading"
        emptyMessage="لا يوجد نشاط موثق."
        entries={[{
          id: 'activity-1',
          subject: null,
          body: 'تم تسجيل متابعة',
          created_at: '2026-10-21T09:00:00Z',
        }]}
        formatDateTime={(value) => `وقت الشركة: ${value}`}
      />,
    );

    expect(screen.getByRole('heading', { name: 'آخر النشاط' }).id).toBe('tenant-activity-heading');
    expect(screen.getByText('تواصل مسجل')).toBeTruthy();
    expect(screen.getByText('تم تسجيل متابعة')).toBeTruthy();
    expect(screen.getByText('وقت الشركة: 2026-10-21T09:00:00Z')).toBeTruthy();
    expect(screen.queryByText('لا يوجد نشاط موثق.')).toBeNull();
  });

  it('preserves the entity-specific empty-state message', () => {
    render(
      <DossierActivitySection
        headingId="person-activity-heading"
        emptyMessage="لا يوجد نشاط موثّق مرتبط بهذا الشخص."
        entries={[]}
        formatDateTime={(value) => value}
      />,
    );

    expect(screen.getByText('لا يوجد نشاط موثّق مرتبط بهذا الشخص.')).toBeTruthy();
  });
});
