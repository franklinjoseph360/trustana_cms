import { Test, TestingModule } from '@nestjs/testing';
import { ProductController } from '../product.controller';
import { ProductService } from '../product.service';

describe('ProductController', () => {
  let controller: ProductController;

  const svcMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  } as unknown as ProductService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [{ provide: ProductService, useValue: svcMock }],
    }).compile();

    controller = module.get(ProductController);
  });

  it('POST /products → create', async () => {
    (svcMock.create as any).mockResolvedValue({ id: 'p1' });
    const res = await controller.create({ name: 'Jasmine Green Tea', categoryId: 'c-leaf' });
    expect(svcMock.create).toHaveBeenCalledWith({ name: 'Jasmine Green Tea', categoryId: 'c-leaf' });
    expect(res).toEqual({ id: 'p1' });
  });

  it('GET /products → findAll', async () => {
    (svcMock.findAll as any).mockResolvedValue([{ id: 'p1' }]);
    const res = await controller.findAll();
    expect(svcMock.findAll).toHaveBeenCalled();
    expect(res).toEqual([{ id: 'p1' }]);
  });

  it('GET /products/:id → findOne', async () => {
    (svcMock.findOne as any).mockResolvedValue({ id: 'p1' });
    const res = await controller.findOne('p1');
    expect(svcMock.findOne).toHaveBeenCalledWith('p1');
    expect(res).toEqual({ id: 'p1' });
  });

  it('PATCH /products/:id → update', async () => {
    (svcMock.update as any).mockResolvedValue({ id: 'p1', name: 'Updated' });
    const res = await controller.update('p1', { name: 'Updated' });
    expect(svcMock.update).toHaveBeenCalledWith('p1', { name: 'Updated' });
    expect(res).toEqual({ id: 'p1', name: 'Updated' });
  });

  it('DELETE /products/:id → remove', async () => {
    (svcMock.remove as any).mockResolvedValue({ ok: true });
    const res = await controller.remove('p1');
    expect(svcMock.remove).toHaveBeenCalledWith('p1');
    expect(res).toEqual({ ok: true });
  });
});
