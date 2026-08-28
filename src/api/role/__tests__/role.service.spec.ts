// `@mikro-orm/nestjs` ships as an ESM-only package (no CJS build) that Jest's
// CommonJS-based module runtime cannot `require()` directly. This test never
// goes through Nest's DI container (the service is constructed manually
// below), so `@InjectRepository` never needs to run for real — mocking it
// out avoids loading the real ESM package while testing genuine service
// behavior.
jest.mock('@mikro-orm/nestjs', () => ({
  InjectRepository: () => () => undefined,
}));
// `emitDecoratorMetadata` forces TS to keep several of these imports alive
// at runtime (referenced in `design:paramtypes`/`design:type` metadata),
// even where they're only ever used as types in the source files — so
// they also need mocks for the same ESM-in-Jest reason as above. This
// covers the transitive imports pulled in by role.service.ts ->
// entities/role.entity.ts -> entities/permission.entity.ts ->
// @core/base/base.entity.ts.
jest.mock('@mikro-orm/core', () => ({
  EntityRepository: class {},
  BaseEntity: class {},
  Collection: class {},
}));
jest.mock('@mikro-orm/decorators/legacy', () => {
  const noopDecorator = () => () => undefined;
  return {
    Entity: noopDecorator,
    PrimaryKey: noopDecorator,
    Property: noopDecorator,
    SerializedPrimaryKey: noopDecorator,
    OneToMany: noopDecorator,
    ManyToOne: noopDecorator,
  };
});
jest.mock('@mikro-orm/mongodb', () => ({
  ObjectId: class {},
}));

import { RoleService } from '../role.service';

describe('RoleService', () => {
  function makeService(findOne: jest.Mock) {
    const repository = {
      findOne,
      getEntityName: () => 'Role',
      getEntityManager: () => ({}),
    } as any;
    return new RoleService(repository);
  }

  it('findByName looks up a role by its name field', async () => {
    const findOne = jest
      .fn()
      .mockResolvedValue({ id: 'role-1', name: 'admin' });
    const service = makeService(findOne);

    const result = await service.findByName('admin');

    expect(findOne).toHaveBeenCalledWith({ name: 'admin' });
    expect(result).toEqual({ id: 'role-1', name: 'admin' });
  });

  it('returns null when no role matches', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const service = makeService(findOne);

    const result = await service.findByName('nonexistent');

    expect(result).toBeNull();
  });
});
