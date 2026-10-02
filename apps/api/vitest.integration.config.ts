import { defineConfig } from 'vitest/config';

// Runs against a real MongoDB replica set (docker compose `mongo`). Each worker uses its own
// database, seatly_test_<VITEST_POOL_ID>, so test files can run in parallel.
export default defineConfig({
  test: {
    name: 'api-integration',
    include: ['test/integration/**/*.test.ts'],
    globalSetup: ['test/helpers/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: { NODE_ENV: 'test' },
  },
});
