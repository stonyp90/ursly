import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**', '**/*.spec.ts', '**/*.test.ts'],
    },
    hmr: {
      overlay: true,
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  optimizeDeps: {
    exclude: ['@tauri-apps/plugin-updater', '@tauri-apps/api/process'],
  },
  build: {
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      external: (id) => {
        // Don't bundle Tauri plugins - they're provided by the runtime
        if (
          id.startsWith('@tauri-apps/plugin-updater') ||
          id.startsWith('@tauri-apps/api/process')
        ) {
          return false; // Let Vite handle it, but don't fail if missing
        }
        return false;
      },
    },
  },
});
