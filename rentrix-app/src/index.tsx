import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyDocumentLanguageDirection } from '@/lib/i18n';
import '@/lib/formatters'; // Ensure global number/date prototype patches are applied immediately
import '@/lib/pwa-install';
import '@/styles/globals.css';
import '@/styles/product-palette.css';
import '@/styles/page-polish.css';
import '@/styles/ux-foundation.css';

applyDocumentLanguageDirection();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
