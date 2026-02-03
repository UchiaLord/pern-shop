import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Wichtig: DB ist shared -> keine Parallelität.
    fileParallelism: false,
    maxThreads: 1,
    minThreads: 1,

    // Stabiler globaler Setup für DB Reset
    setupFiles: ['./test/_setup.js'],

    // Node environment (Supertest)
    environment: 'node',
  },
});