import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Standalone marketing site for Rentrix — intentionally independent from the
// main app's build so it can be deployed on its own (Vercel/Netlify/any static host).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 4400 },
  preview: { port: 4400 },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
