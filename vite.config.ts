import { defineConfig } from 'vite';

export default defineConfig({
  base: '/the-swarm/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
