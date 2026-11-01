import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
  build: {
    // The manifest lets `pnpm size` add up what each page loads (NFR-02).
    manifest: true,
    // The MVP mock API chunk carries all fixtures; it is not part of v1 (SDD 7.4), so it is
    // reported apart from the page budget.
    chunkSizeWarningLimit: 1000,
  },
});
