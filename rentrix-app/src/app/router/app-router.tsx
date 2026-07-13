import { createRouter, RouterProvider } from '@tanstack/react-router';
import { routeTree } from '@/app/router/route-tree';

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPendingMinMs: 250,
  context: {},
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function AppRouterProvider() {
  return <RouterProvider router={router} />;
}
