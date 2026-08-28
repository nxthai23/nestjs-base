// `@mikro-orm/mongodb` ships as an ESM-only package (no CJS build) that Jest's
// CommonJS-based module runtime cannot `require()` directly. `ObjectId` is only
// referenced as a type by entities in source, but `emitDecoratorMetadata` keeps
// it alive as a runtime value. Any spec file that hits this needs
// `jest.mock('@mikro-orm/mongodb')` — Jest then picks up this file
// automatically (manual mock convention).
export class ObjectId {}
