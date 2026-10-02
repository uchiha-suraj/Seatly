// Bundles the API (and @seatly/shared, which ships TypeScript source) into dist/server.js.
// Third-party packages stay external and are loaded from node_modules at runtime.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  packages: 'external',
  alias: { '@seatly/shared': fileURLToPath(new URL('../../../packages/shared/src/index.ts', import.meta.url)) },
  logLevel: 'info',
});
