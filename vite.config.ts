import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    {
      name: 'remove-vite-folder',
      closeBundle() {
        const viteDir = path.resolve('dist/.vite');
        if (fs.existsSync(viteDir)) {
          fs.rmSync(viteDir, { recursive: true, force: true });
        }
      },
    },
  ],
  build: {
    rollupOptions: {
      // Ensure content scripts with ?inline imports bundle correctly
      output: {
        // Keep content script as a single file (no chunking)
        manualChunks: undefined,
      },
    },
  },
});
