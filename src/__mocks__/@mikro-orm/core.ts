// `@mikro-orm/core` ships as an ESM-only package (no CJS build) that Jest's
// CommonJS-based module runtime cannot `require()` directly. `emitDecoratorMetadata`
// forces TS to keep several of these imports alive at runtime (referenced in
// `design:paramtypes`/`design:type` metadata) even where source files only ever
// use them as types, so real values are needed here for anything unit tests
// touch. Any spec file that hits this needs `jest.mock('@mikro-orm/core')` —
// Jest then picks up this file automatically (manual mock convention).
export class EntityRepository {}
export class BaseEntity {}
export class Collection {}

// Used by BaseService's update/delete/upsert (src/core/base/base.service.ts).
// Mirrors the real `wrap(entity).assign(data)` shape closely enough for unit
// tests that exercise those methods against a plain mocked entity.
export const wrap = (entity: any) => ({
  assign: (data: any) => Object.assign(entity, data),
});
