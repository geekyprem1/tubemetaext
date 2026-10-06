import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  if (mode === 'worker') {
    return {
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        target: 'esnext',
        sourcemap: false,
        minify: false,
        lib: {
          entry: 'src/background/index.ts',
          formats: ['es'],
          fileName: () => 'worker.js',
        },
      },
    };
  }

  if (mode === 'content') {
    return {
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        target: 'esnext',
        sourcemap: false,
        minify: false,
        lib: {
          entry: 'src/content/index.ts',
          formats: ['iife'],
          name: 'TubeMetaContent',
          fileName: () => 'content.js',
        },
      },
    };
  }

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      target: 'esnext',
      sourcemap: false,
      rollupOptions: {
        input: 'popup.html',
      },
    },
  };
});
