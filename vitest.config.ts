import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
          testTimeout: 20_000
        }
      },
      {
        test: {
          name: 'smoke',
          include: ['test/smoke.e2e.test.ts'],
          testTimeout: 900_000,
          hookTimeout: 900_000
        }
      }
    ]
  }
});
