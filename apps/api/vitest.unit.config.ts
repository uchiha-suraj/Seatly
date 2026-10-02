import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { name: 'api-unit', include: ['test/unit/**/*.test.ts'], env: { NODE_ENV: 'test' } } });
