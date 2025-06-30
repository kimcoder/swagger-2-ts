import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { defineConfig } from 'vite';
import manifest from './src/manifest';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    build: {
      emptyOutDir: true,
      outDir: 'build',
      rollupOptions: {
        output: {
          chunkFileNames: 'assets/[name]-[hash].js',
        },
      },
    },

    plugins: [crx({ manifest }), react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      watch: false,
      setupFiles: './src/setup-test.ts',
      coverage: {
        reporter: ['text', 'json', 'html'],
      },
    },
  };
});
