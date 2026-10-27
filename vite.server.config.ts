import { defineConfig } from 'vite';

// Bouwt de Pi-server (server/main.ts) tot één bestand zonder afhankelijkheden: dist-server/server.mjs.
export default defineConfig({
  build: {
    ssr: 'server/main.ts',
    outDir: 'dist-server',
    emptyOutDir: false,
    target: 'node18',
    rollupOptions: { output: { entryFileNames: 'server.mjs', format: 'es' } },
  },
  publicDir: false,
  ssr: { noExternal: true },
});
