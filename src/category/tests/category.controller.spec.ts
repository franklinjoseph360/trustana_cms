import { Test, TestingModule } from '@nestjs/testing';
import { CategoryController } from '../category.controller';
import { CategoryService } from '../category.service';

describe('CategoryController', () => {
  let controller: CategoryController;

  const svcMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  } as unknown as CategoryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [{ provide: CategoryService, useValue: svcMock }],
    }).compile();

    controller = module.get<CategoryController>(CategoryController);
  });

  it('POST /categories → create', async () => {
    (svcMock.create as any).mockResolvedValue({ id: 'c1' });
    const res = await controller.create({ name: 'Beverages', slug: 'beverages' });
    expect(svcMock.create).toHaveBeenCalledWith({ name: 'Beverages', slug: 'beverages' });
    expect(res).toEqual({ id: 'c1' });
  });

  it('GET /categories → findAll', async () => {
    (svcMock.findAll as any).mockResolvedValue([{ id: 'c1' }]);
    const res = await controller.findAll();
    expect(svcMock.findAll).toHaveBeenCalled();
    expect(res).toEqual([{ id: 'c1' }]);
  });

  it('GET /categories/:id → findOne', async () => {
    (svcMock.findOne as any).mockResolvedValue({ id: 'c1' });
    const res = await controller.findOne('c1');
    expect(svcMock.findOne).toHaveBeenCalledWith('c1');
    expect(res).toEqual({ id: 'c1' });
  });

  it('PATCH /categories/:id → update', async () => {
    (svcMock.update as any).mockResolvedValue({ id: 'c1', name: 'Drinks' });
    const res = await controller.update('c1', { name: 'Drinks' });
    expect(svcMock.update).toHaveBeenCalledWith('c1', { name: 'Drinks' });
    expect(res).toEqual({ id: 'c1', name: 'Drinks' });
  });

  it('DELETE /categories/:id → remove', async () => {
    (svcMock.remove as any).mockResolvedValue({ ok: true });
    const res = await controller.remove('c1');
    expect(svcMock.remove).toHaveBeenCalledWith('c1');
    expect(res).toEqual({ ok: true });
  });
});
