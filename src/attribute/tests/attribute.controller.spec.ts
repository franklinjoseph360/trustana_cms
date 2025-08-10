import { Test, TestingModule } from '@nestjs/testing';
import { AttributeController } from '../../attribute/attribute.controller';
import { AttributeService } from '../../attribute/attribute.service';

describe('AttributeController', () => {
  let controller: AttributeController;

  const svcMock = {
    create: jest.fn(),
    findAttributes: jest.fn(),
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

  it('POST /attributes → create', async () => {
    (svcMock.create as any).mockResolvedValue({ id: 'a1' });
    const res = await controller.create({ name: 'Caffeine', slug: 'caffeine' } as any);
    expect(svcMock.create).toHaveBeenCalledWith({ name: 'Caffeine', slug: 'caffeine' });
    expect(res).toEqual({ id: 'a1' });
  });

  it('GET /attributes (no params) → defaults', async () => {
    (svcMock.findAttributes as any).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50, filters: { categories: [], attributeTypes: ['direct','inherited','global'] } });
    await controller.find(undefined, undefined, undefined, undefined, undefined, undefined);
    expect(svcMock.findAttributes).toHaveBeenCalledWith({
      categoryIds: undefined,
      linkTypes: undefined,
      q: undefined,
      page: 1,
      pageSize: 50,
      sort: 'name',
    });
  });

  it('GET /attributes with CSV categoryIds', async () => {
    (svcMock.findAttributes as any).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50, filters: { categories: [], attributeTypes: ['direct','inherited','global'] } });
    await controller.find('c1,c2', undefined, undefined, '1', '50', 'name');
    expect(svcMock.findAttributes).toHaveBeenCalledWith(expect.objectContaining({ categoryIds: ['c1','c2'] }));
  });

  it('GET /attributes with repeated categoryIds', async () => {
    (svcMock.findAttributes as any).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50, filters: { categories: [], attributeTypes: ['direct','inherited','global'] } });
    await controller.find(['c1','c2'], undefined, undefined, '1', '50', 'name');
    expect(svcMock.findAttributes).toHaveBeenCalledWith(expect.objectContaining({ categoryIds: ['c1','c2'] }));
  });

  it('GET /attributes with linkType=direct,inherited (CSV)', async () => {
    (svcMock.findAttributes as any).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50, filters: { categories: [], attributeTypes: ['direct','inherited','global'] } });
    await controller.find(undefined, 'direct,inherited', undefined, '1', '50', 'name');
    expect(svcMock.findAttributes).toHaveBeenCalledWith(expect.objectContaining({ linkTypes: ['direct','inherited'] }));
  });

  it('GET /attributes with repeated linkType', async () => {
    (svcMock.findAttributes as any).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50, filters: { categories: [], attributeTypes: ['direct','inherited','global'] } });
    await controller.find(undefined, ['global','direct'], undefined, '1', '50', 'name');
    expect(svcMock.findAttributes).toHaveBeenCalledWith(expect.objectContaining({ linkTypes: ['global','direct'] }));
  });

  it('GET /attributes with q/page/pageSize/sort', async () => {
    (svcMock.findAttributes as any).mockResolvedValue({ items: [], total: 0, page: 3, pageSize: 10, filters: { categories: [], attributeTypes: ['direct','inherited','global'] } });
    await controller.find('c1', 'global', 'tea', '3', '10', 'updatedAt');
    expect(svcMock.findAttributes).toHaveBeenCalledWith({
      categoryIds: ['c1'],
      linkTypes: ['global'],
      q: 'tea',
      page: 3,
      pageSize: 10,
      sort: 'updatedAt',
    });
  });

  it('PATCH /attributes/:id → update', async () => {
    (svcMock.update as any).mockResolvedValue({ id: 'a1', name: 'X' });
    const res = await controller.update('a1', { name: 'X' } as any);
    expect(svcMock.update).toHaveBeenCalledWith('a1', { name: 'X' });
    expect(res).toEqual({ id: 'a1', name: 'X' });
  });

  it('DELETE /attributes/:id → remove', async () => {
    (svcMock.remove as any).mockResolvedValue({ ok: true });
    const res = await controller.remove('a1');
    expect(svcMock.remove).toHaveBeenCalledWith('a1');
    expect(res).toEqual({ ok: true });
  });
});
