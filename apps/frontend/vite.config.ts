import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@p2p/core': resolve(__dirname, '../../packages/p2p-core/dist'),
      '@p2p/types': resolve(__dirname, '../../packages/types/dist'),
      '@p2p/ui': resolve(__dirname, '../../packages/ui-components/dist'),
    },
  },
  server: {
    port: 3000,
    host: true,
    https: false, // Will be configured for HTTPS in production
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@headlessui/react', '@heroicons/react'],
        },
      },
    },
  },
  define: {
    // Enable WebRTC in development
    global: 'globalThis',
  },
});
