import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/test/**',
        '**/*.d.ts',
        'vitest.config.ts',
        'vite.config.ts',
        'tailwind.config.js',
        'postcss.config.js',
        'src/main.tsx',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@p2p/core': resolve(__dirname, '../../packages/p2p-core/dist'),
      '@p2p/types': resolve(__dirname, '../../packages/types/dist'),
      '@p2p/ui': resolve(__dirname, '../../packages/ui-components/dist'),
    },
  },
});
