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

describe('BaseService.find', () => {
  it('defaults to page 1 / limit 10', async () => {
    const { service, repository } = makeService(async () => [[], 0]);

    const result = await service.find();

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

    const result = await service.find({}, { page: 3, limit: 20 });

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

    await service.find({}, { limit: 999999 });

    expect(repository.findAndCount).toHaveBeenCalledWith(
      {},
      { limit: 100, offset: 0, populate: undefined },
    );
  });

  it('clamps page below 1 up to 1', async () => {
    const { service, repository } = makeService(async () => [[], 0]);

    await service.find({}, { page: -5 });

    expect(repository.findAndCount).toHaveBeenCalledWith(
      {},
      { limit: 10, offset: 0, populate: undefined },
    );
  });

  it('coerces numeric-string params (unwrapped query values)', async () => {
    const { service, repository } = makeService(async () => [[], 0]);

    await service.find({}, { page: '2' as any, limit: '5' as any });

    expect(repository.findAndCount).toHaveBeenCalledWith(
      {},
      { limit: 5, offset: 5, populate: undefined },
    );
  });

  it('returns items and total from findAndCount as-is', async () => {
    const items = [{ id: '1' }, { id: '2' }];
    const { service } = makeService(async () => [items, 2]);

    const result = await service.find();

    expect(result.items).toBe(items);
    expect(result.meta.total).toBe(2);
  });

  describe('paginate: false (escape hatch)', () => {
    it('skips limit/offset and reports one page covering everything', async () => {
      const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const { service, repository } = makeService(async () => [items, 3]);

      const result = await service.find({}, undefined, false);

      expect(repository.findAndCount).toHaveBeenCalledWith(
        {},
        { limit: undefined, offset: undefined, populate: undefined },
      );
      expect(result.items).toBe(items);
      expect(result.meta).toEqual({
        page: 1,
        limit: 3,
        total: 3,
        totalPages: 1,
      });
    });

    it('reports totalPages: 0 for an empty result', async () => {
      const { service } = makeService(async () => [[], 0]);

      const result = await service.find({}, undefined, false);

      expect(result.meta).toEqual({
        page: 1,
        limit: 0,
        total: 0,
        totalPages: 0,
      });
    });

    it('ignores page/limit in options when paginate is false', async () => {
      const { service, repository } = makeService(async () => [[], 0]);

      await service.find({}, { page: 5, limit: 2 }, false);

      expect(repository.findAndCount).toHaveBeenCalledWith(
        {},
        { limit: undefined, offset: undefined, populate: undefined },
      );
    });
  });
});

describe('BaseService.bulkCreate', () => {
  function makeService(transactional: (...args: any[]) => Promise<any>) {
    const repository = {
      getEntityName: () => 'TestEntity',
      getEntityManager: () => ({ transactional: vi.fn(transactional) }),
      create: vi.fn((dto: any) => ({ ...dto })),
    } as any;
    return { service: new TestService(repository), repository };
  }

  it('returns true without starting a transaction for an empty batch', async () => {
    const transactional = vi.fn();
    const { service, repository } = makeService(transactional);

    await expect(service.bulkCreate([])).resolves.toBe(true);
    expect(repository.getEntityManager().transactional).not.toHaveBeenCalled();
  });

  it('persists every created entity inside the transaction', async () => {
    const persist = vi.fn();
    const { service, repository } = makeService(async (cb: any) =>
      cb({ persist }),
    );

    const result = await service.bulkCreate([
      { name: 'a' },
      { name: 'b' },
    ] as any);

    expect(result).toBe(true);
    expect(repository.create).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it('propagates a transaction failure instead of resolving true', async () => {
    const { service } = makeService(() =>
      Promise.reject(new Error('tx failed')),
    );

    await expect(service.bulkCreate([{ name: 'a' }] as any)).rejects.toThrow(
      'tx failed',
    );
  });
});

describe('BaseService.findAll', () => {
  it('delegates to find({}, options, paginate)', async () => {
    const items = [{ id: '1' }];
    const { service, repository } = makeService(async () => [items, 1]);

    const result = await service.findAll({ page: 2, limit: 5 });

    expect(repository.findAndCount).toHaveBeenCalledWith(
      {},
      { limit: 5, offset: 5, populate: undefined },
    );
    expect(result.items).toBe(items);
  });

  it('forwards the paginate flag', async () => {
    const { service, repository } = makeService(async () => [[], 0]);

    await service.findAll(undefined, false);

    expect(repository.findAndCount).toHaveBeenCalledWith(
      {},
      { limit: undefined, offset: undefined, populate: undefined },
    );
  });
});
