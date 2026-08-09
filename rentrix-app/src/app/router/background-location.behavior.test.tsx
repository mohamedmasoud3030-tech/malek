// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';

const navigate = vi.fn();
let location: any = {
  pathname: '/people',
  search: { search: 'أحمد', type: 'tenant', page: 2 },
  hash: '',
  state: {},
};
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useLocation: () => location,
}));

const { BackgroundLocationProvider, useDialogNavigate } = await import('./background-location');

function wrapper({ children }: PropsWithChildren) {
  return <BackgroundLocationProvider>{children}</BackgroundLocationProvider>;
}

describe('route-native dialog navigation context', () => {
  it('carries filters/search/page and the exact background into a canonical detail URL', () => {
    const { result } = renderHook(() => useDialogNavigate(), { wrapper });
    act(() => {
      result.current({ to: '/people/$personId', params: { personId: 'person-1' } });
    });
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({
      to: '/people/$personId',
      params: { personId: 'person-1' },
      search: { search: 'أحمد', type: 'tenant', page: 2 },
      state: { backgroundLocation: location },
    }));
  });

  it('preserves an existing background for nested previews', () => {
    const listLocation = { pathname: '/owners', search: { search: 'مالك' }, hash: '', state: {} };
    location = {
      pathname: '/owners/owner-1',
      search: { search: 'مالك' },
      hash: '',
      state: { backgroundLocation: listLocation },
    };
    const { result } = renderHook(() => useDialogNavigate(), { wrapper });
    act(() => {
      result.current({ to: '/properties/$propertyId', params: { propertyId: 'property-1' } });
    });
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({
      to: '/properties/$propertyId',
      state: { backgroundLocation: listLocation },
    }));
  });
});
