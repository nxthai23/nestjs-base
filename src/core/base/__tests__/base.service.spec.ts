vi.mock('@mikro-orm/core', () =>
  import('@libs/__test__/mikro-orm.mock').then((m) => m.mikroOrmCoreMock()),
);

import { BaseService } from '../base.service';
import { BaseEntity } from '../base.entity';

class TestEntity extends BaseEntity {}

class TestService extends BaseService<TestEntity> {}

function makeService(findAndCount: (...args: any[]) => Promise<any>) {
  const repository = {
    getEntityName: () => 'TestEntity',
    getEntityManager: () => ({}),
    findAndCount: vi.fn(findAndCount),
  } as any;
  return { service: new TestService(repository), repository };
}

describe('BaseService.paginate', () => {
  it('defaults to page 1 / limit 10', async () => {
    const { service, repository } = makeService(async () => [[], 0]);

    const result = await service.paginate();

    expect(repository.findAndCount).toHaveBeenCalledWith(
      {},
      { limit: 10, offset: 0, populate: undefined },
    );
    expect(result.meta).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    });
  });

  it('computes offset from page and limit', async () => {
    const { service, repository } = makeService(async () => [[], 42]);

    const result = await service.paginate({}, { page: 3, limit: 20 });

    expect(repository.findAndCount).toHaveBeenCalledWith(
      {},
      { limit: 20, offset: 40, populate: undefined },
    );
    expect(result.meta).toEqual({
      page: 3,
      limit: 20,
      total: 42,
      totalPages: 3,
    });
  });

  it('clamps limit above MAX_LIMIT down to 100', async () => {
    const { service, repository } = makeService(async () => [[], 0]);

    await service.paginate({}, { limit: 999999 });

    expect(repository.findAndCount).toHaveBeenCalledWith(
      {},
      { limit: 100, offset: 0, populate: undefined },
    );
  });

  it('clamps page below 1 up to 1', async () => {
    const { service, repository } = makeService(async () => [[], 0]);

    await service.paginate({}, { page: -5 });

    expect(repository.findAndCount).toHaveBeenCalledWith(
      {},
      { limit: 10, offset: 0, populate: undefined },
    );
  });

  it('coerces numeric-string params (unwrapped query values)', async () => {
    const { service, repository } = makeService(async () => [[], 0]);

    await service.paginate({}, { page: '2' as any, limit: '5' as any });

    expect(repository.findAndCount).toHaveBeenCalledWith(
      {},
      { limit: 5, offset: 5, populate: undefined },
    );
  });

  it('returns items and total from findAndCount as-is', async () => {
    const items = [{ id: '1' }, { id: '2' }];
    const { service } = makeService(async () => [items, 2]);

    const result = await service.paginate();

    expect(result.items).toBe(items);
    expect(result.meta.total).toBe(2);
  });
});
