import { Test, TestingModule } from '@nestjs/testing';
import { AttributeController } from '../attribute.controller';
import { AttributeService } from '../attribute.service';

describe('AttributeController', () => {
  let controller: AttributeController;

  const svcMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  } as unknown as AttributeService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttributeController],
      providers: [{ provide: AttributeService, useValue: svcMock }],
    }).compile();

    controller = module.get(AttributeController);
  });

  it('create delegates to service', async () => {
    (svcMock.create as any).mockResolvedValue({ id: 'a1' });
    const res = await controller.create({ name: 'Caffeine', slug: 'caffeine' });
    expect(svcMock.create).toHaveBeenCalledWith({ name: 'Caffeine', slug: 'caffeine' });
    expect(res).toEqual({ id: 'a1' });
  });

  it('findAll delegates', async () => {
    (svcMock.findAll as any).mockResolvedValue([{ id: 'a1' }]);
    const res = await controller.findAll();
    expect(svcMock.findAll).toHaveBeenCalled();
    expect(res).toEqual([{ id: 'a1' }]);
  });

  it('findOne delegates', async () => {
    (svcMock.findOne as any).mockResolvedValue({ id: 'a1' });
    const res = await controller.findOne('a1');
    expect(svcMock.findOne).toHaveBeenCalledWith('a1');
    expect(res).toEqual({ id: 'a1' });
  });

  it('update delegates', async () => {
    (svcMock.update as any).mockResolvedValue({ id: 'a1', name: 'X' });
    const res = await controller.update('a1', { name: 'X' });
    expect(svcMock.update).toHaveBeenCalledWith('a1', { name: 'X' });
    expect(res).toEqual({ id: 'a1', name: 'X' });
  });

  it('remove delegates', async () => {
    (svcMock.remove as any).mockResolvedValue({ ok: true });
    const res = await controller.remove('a1');
    expect(svcMock.remove).toHaveBeenCalledWith('a1');
    expect(res).toEqual({ ok: true });
  });
});
