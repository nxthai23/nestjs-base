// `@mikro-orm/nestjs` ships as an ESM-only package (no CJS build) that Jest's
// CommonJS-based module runtime cannot `require()` directly. Unit tests that
// construct services manually (never going through Nest's DI container)
// never need `@InjectRepository` to run for real, so it's mocked out here.
// Any spec file that hits this needs `jest.mock('@mikro-orm/nestjs')` —
// Jest then picks up this file automatically (manual mock convention).
export const InjectRepository = () => () => undefined;
