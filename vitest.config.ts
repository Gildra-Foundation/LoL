import path from 'node:path';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: { alias: { '@rift/engine': path.resolve('packages/engine'), '@': path.resolve('apps/lol/src') } },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
