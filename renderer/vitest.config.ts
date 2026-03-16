import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    // configure coverage using the V8 provider supported by Vitest v1+
    coverage: {
      provider: 'v8',
      reportsDirectory: path.resolve(process.cwd(), 'coverage'),
      reporter: ['lcov', 'text-summary', 'json'],
      all: true,
      // thresholds are specified under 'threshold' for V8 provider
      thresholds: {
        global: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
});
