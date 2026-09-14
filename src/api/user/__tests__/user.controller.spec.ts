import { UserController } from '../user.controller';
import type { UserService } from '../user.service';

describe('UserController.fetch', () => {
  function makeController(userService: Partial<UserService>) {
    return new UserController(userService as UserService);
  }

  it('paginates through the service and wraps the result via ApiResult.paginated', async () => {
    const items = [{ id: '1' }, { id: '2' }];
    const meta = { page: 1, limit: 10, total: 2, totalPages: 1 };
    const userService = {
      paginate: vi.fn().mockResolvedValue({ items, meta }),
    };
    const controller = makeController(userService);

    const result = await controller.fetch({});

    expect(userService.paginate).toHaveBeenCalledWith({}, {});
    expect(result.success).toBe(true);
    expect(result.data).toBe(items);
    expect(result.meta).toEqual(meta);
  });

  it('forwards page/limit query params to the service', async () => {
    const userService = {
      paginate: vi.fn().mockResolvedValue({
        items: [],
        meta: { page: 2, limit: 5, total: 0, totalPages: 0 },
      }),
    };
    const controller = makeController(userService);

    await controller.fetch({ page: 2, limit: 5 });

    expect(userService.paginate).toHaveBeenCalledWith(
      {},
      { page: 2, limit: 5 },
    );
  });
});
