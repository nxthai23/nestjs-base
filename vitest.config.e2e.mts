import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    root: './',
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    testTimeout: 30000,
    server: {
      deps: {
        // Force every @nestjs/* and mikro-orm ESM package through the same
        // Vite module graph. Left external, Node's native ESM loader and
        // Vite's SSR runner each create their own copy of these classes,
        // and Nest's DI matches providers by class identity - two copies
        // means "ApplicationConfig" from one side never equals the other.
        inline: [/^@nestjs\//, /^@mikro-orm\//, 'nestjs-pino'],
      },
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
