import { Test, TestingModule } from '@nestjs/testing';
import { AttributeController } from '../../attribute/attribute.controller';
import { AttributeService } from '../../attribute/attribute.service';

describe('AttributeController', () => {
  let controller: AttributeController;

  const svcMock = {
    create: jest.fn(),
    findWithFilters: jest.fn(),
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

  // ---------- create ----------
  it('POST /attributes → create', async () => {
    (svcMock.create as any).mockResolvedValue({ id: 'a1' });
    const res = await controller.create({ name: 'Caffeine', slug: 'caffeine' } as any);
    expect(svcMock.create).toHaveBeenCalledWith({ name: 'Caffeine', slug: 'caffeine' });
    expect(res).toEqual({ id: 'a1' });
  });

  // ---------- find (no params) ----------
  it('GET /attributes (no params) → defaults', async () => {
    (svcMock.findWithFilters as any).mockResolvedValue({ items: [], total: 0 });
    await controller.find(undefined, undefined, undefined, undefined, undefined, undefined);

    expect(svcMock.findWithFilters).toHaveBeenCalledWith({
      categoryIds: undefined,
      linkTypes: undefined,
      q: undefined,
      page: 1,            // default
      pageSize: 50,       // default
      sort: 'name',       // default
    });
  });

  // ---------- find with CSV categoryIds ----------
  it('GET /attributes?categoryIds=c1,c2', async () => {
    (svcMock.findWithFilters as any).mockResolvedValue({ items: [], total: 0 });
    await controller.find('c1,c2', undefined, undefined, '1', '50', 'name');
    expect(svcMock.findWithFilters).toHaveBeenCalledWith(
      expect.objectContaining({ categoryIds: ['c1', 'c2'] }),
    );
  });

  // ---------- find with repeated categoryIds ----------
  it('GET /attributes?categoryIds=c1&categoryIds=c2', async () => {
    (svcMock.findWithFilters as any).mockResolvedValue({ items: [], total: 0 });
    await controller.find(['c1', 'c2'], undefined, undefined, '1', '50', 'name');
    expect(svcMock.findWithFilters).toHaveBeenCalledWith(
      expect.objectContaining({ categoryIds: ['c1', 'c2'] }),
    );
  });

  // ---------- find with linkType CSV ----------
  it('GET /attributes?linkType=direct,inherited', async () => {
    (svcMock.findWithFilters as any).mockResolvedValue({ items: [], total: 0 });
    await controller.find(undefined, 'direct,inherited', undefined, '1', '50', 'name');
    expect(svcMock.findWithFilters).toHaveBeenCalledWith(
      expect.objectContaining({ linkTypes: ['direct', 'inherited'] }),
    );
  });

  // ---------- find with repeated linkType ----------
  it('GET /attributes?linkType=direct&linkType=global', async () => {
    (svcMock.findWithFilters as any).mockResolvedValue({ items: [], total: 0 });
    await controller.find(undefined, ['direct', 'global'], undefined, '1', '50', 'name');
    expect(svcMock.findWithFilters).toHaveBeenCalledWith(
      expect.objectContaining({ linkTypes: ['direct', 'global'] }),
    );
  });

  // ---------- find with q, page, pageSize, sort ----------
  it('GET /attributes with q/page/pageSize/sort', async () => {
    (svcMock.findWithFilters as any).mockResolvedValue({ items: [], total: 0 });
    await controller.find('c1', 'global', 'tea', '3', '10', 'updatedAt');

    expect(svcMock.findWithFilters).toHaveBeenCalledWith({
      categoryIds: ['c1'],
      linkTypes: ['global'],
      q: 'tea',
      page: 3,
      pageSize: 10,
      sort: 'updatedAt',
    });
  });

  // ---------- page/pageSize coercion & clamping ----------
  it('GET /attributes clamps page/pageSize and coerces numbers', async () => {
    (svcMock.findWithFilters as any).mockResolvedValue({ items: [], total: 0 });
    await controller.find(undefined, undefined, undefined, 'not-a-number', '-5', 'name');

    expect(svcMock.findWithFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,          // coerced default
        pageSize: 1,      // clamped min
      }),
    );
  });

  // ---------- findOne ----------
  it('GET /attributes/:id → findOne', async () => {
    (svcMock.findOne as any).mockResolvedValue({ id: 'a1' });
    const res = await controller.findOne('a1');
    expect(svcMock.findOne).toHaveBeenCalledWith('a1');
    expect(res).toEqual({ id: 'a1' });
  });

  // ---------- update ----------
  it('PATCH /attributes/:id → update', async () => {
    (svcMock.update as any).mockResolvedValue({ id: 'a1', name: 'X' });
    const res = await controller.update('a1', { name: 'X' } as any);
    expect(svcMock.update).toHaveBeenCalledWith('a1', { name: 'X' });
    expect(res).toEqual({ id: 'a1', name: 'X' });
  });

  // ---------- remove ----------
  it('DELETE /attributes/:id → remove', async () => {
    (svcMock.remove as any).mockResolvedValue({ ok: true });
    const res = await controller.remove('a1');
    expect(svcMock.remove).toHaveBeenCalledWith('a1');
    expect(res).toEqual({ ok: true });
  });
});
