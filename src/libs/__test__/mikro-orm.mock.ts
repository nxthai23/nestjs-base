// `@mikro-orm/*` ships as ESM-only packages (no CJS build). Specs whose
// services are constructed manually - never through Nest's DI container -
// never need the real ORM to load, so these factories stand in for it via
// `vi.mock('@mikro-orm/x', mikroOrmXMock)`. `emitDecoratorMetadata` keeps
// several of these imports alive at runtime (referenced in
// `design:paramtypes`/`design:type` metadata) even where entities only use
// them as types, so the mocked exports need to be real values, not just types.

export const mikroOrmNestjsMock = () => ({
  InjectRepository: () => () => undefined,
});

export const mikroOrmCoreMock = () => ({
  EntityRepository: class {},
  BaseEntity: class {},
  Collection: class {},
  // Mirrors the real `wrap(entity).assign(data)` shape closely enough for
  // unit tests that exercise BaseService's update/delete/upsert methods
  // (src/core/base/base.service.ts) against a plain mocked entity.
  wrap: (entity: any) => ({
    assign: (data: any) => Object.assign(entity, data),
  }),
});

const noopDecorator = () => () => undefined;

export const mikroOrmDecoratorsLegacyMock = () => ({
  Entity: noopDecorator,
  PrimaryKey: noopDecorator,
  Property: noopDecorator,
  SerializedPrimaryKey: noopDecorator,
  OneToMany: noopDecorator,
  ManyToOne: noopDecorator,
});

export const mikroOrmMongodbMock = () => ({
  ObjectId: class {},
});
