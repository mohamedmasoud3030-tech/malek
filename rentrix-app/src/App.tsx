import { AppProviders } from '@/app/providers/app-providers';
import { AppRouterProvider } from '@/app/router/app-router';

export default function App() {
  return (
    <AppProviders>
      <AppRouterProvider />
    </AppProviders>
  );
}
