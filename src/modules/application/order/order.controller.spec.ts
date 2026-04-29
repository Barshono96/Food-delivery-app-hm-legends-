import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { QueryOrderDto } from './dto/query-order.dto';

describe('OrderController', () => {
  let controller: OrderController;
  let service: jest.Mocked<OrderService>;

  const mockOrderService: jest.Mocked<Partial<OrderService>> = {
    create: jest.fn(),
    findAllForManager: jest.fn(),
    findAllForAdmin: jest.fn(),
    findOneOrder: jest.fn(),
    approveOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        {
          provide: OrderService,
          useValue: mockOrderService,
        },
      ],
    }).compile();

    controller = module.get<OrderController>(OrderController);
    service = module.get(OrderService) as jest.Mocked<OrderService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call service.create with dto and user_id from req.user.userId', async () => {
    const dto: any = { items: [{ id: 'p1', qty: 2 }] };
    const req: any = { user: { userId: 'manager-1' } };
    service.create.mockResolvedValueOnce({ id: 'o1' } as any);

    const res = await controller.create(req, dto);

    expect(service.create).toHaveBeenCalledWith(dto, 'manager-1');
    expect(res).toEqual({ id: 'o1' });
  });

  it('should pass req.user.id to findAllForManager along with QueryOrderDto', async () => {
    const req: any = { user: { id: 'manager-2' } };
    const query: QueryOrderDto = { page: 1, limit: 10 } as any;
    const expected = { data: [], meta: { page: 1, limit: 10 } } as any;
    service.findAllForManager.mockResolvedValueOnce(expected);

    const res = await controller.findAllForManager(req, query);

    expect(service.findAllForManager).toHaveBeenCalledWith('manager-2', query);
    expect(res).toBe(expected);
  });

  it('should pass req.user.userId to findAllForAdmin along with QueryOrderDto', async () => {
    const req: any = { user: { userId: 'admin-1' } };
    const query: QueryOrderDto = { page: 2, limit: 5 } as any;
    const expected = {
      data: [{ id: 'o2' }],
      meta: { page: 2, limit: 5 },
    } as any;
    service.findAllForAdmin.mockResolvedValueOnce(expected);

    const res = await controller.findAllForAdmin(req, query);

    expect(service.findAllForAdmin).toHaveBeenCalledWith('admin-1', query);
    expect(res).toBe(expected);
  });

  it('should delegate to service.findOneOrder with provided id', async () => {
    service.findOneOrder.mockResolvedValueOnce({
      id: 'o3',
      status: 'PENDING',
    } as any);

    const res = await controller.findOneOrder('o3');

    expect(service.findOneOrder).toHaveBeenCalledWith('o3');
    expect(res).toEqual({ id: 'o3', status: 'PENDING' });
  });

  it('should approve an order by id through service.approveOne', async () => {
    service.approveOne.mockResolvedValueOnce({
      id: 'o4',
      status: 'APPROVED',
    } as any);

    const res = await controller.approveOne('o4');

    expect(service.approveOne).toHaveBeenCalledWith('o4');
    expect(res).toEqual({ id: 'o4', status: 'APPROVED' });
  });
});
