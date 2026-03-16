import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'c8',
      reportsDirectory: path.resolve(__dirname, 'coverage'),
      reporter: ['lcov', 'text-summary', 'json'],
      all: true,
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
});
