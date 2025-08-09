import { Test, TestingModule } from '@nestjs/testing';
import { CategoryService } from '../../category/category.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoryTreePathService } from '../../category-tree-path/category-tree-path.service';
import { NotFoundException } from '@nestjs/common';

describe('CategoryService', () => {
  let service: CategoryService;

  const now = new Date();

  // Reusable tx mock (we use the same object as the tx inside $transaction)
  const prismaMock = {
    $transaction: jest.fn(async (cb: any) => cb(prismaMock)),
    category: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as unknown as PrismaService;

  const pathSvcMock = {
    addPathsForNewCategory: jest.fn(),
    rebuildSubtreePaths: jest.fn(),
  } as unknown as CategoryTreePathService;

  const root = {
    id: 'c_root',
    name: 'Beverages',
    slug: 'beverages',
    isLeaf: false,
    parentId: null as string | null,
    createdAt: now,
    updatedAt: now,
  };

  const child = {
    id: 'c_child',
    name: 'Tea',
    slug: 'tea',
    isLeaf: true,
    parentId: 'c_root',
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CategoryTreePathService, useValue: pathSvcMock },
      ],
    }).compile();

    service = module.get(CategoryService);
  });

  // -------- create --------
  it('create() creates category and populates paths in a single transaction', async () => {
    (prismaMock.category.create as any).mockResolvedValue(child);

    await service.create({
      name: 'Tea',
      slug: 'tea',
      isLeaf: true,
      parentId: 'c_root',
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.category.create).toHaveBeenCalledWith({
      data: { name: 'Tea', slug: 'tea', isLeaf: true, parentId: 'c_root' },
    });
    expect(pathSvcMock.addPathsForNewCategory).toHaveBeenCalledTimes(1);
    expect(pathSvcMock.addPathsForNewCategory).toHaveBeenCalledWith(
      prismaMock as any,
      { id: 'c_child', parentId: 'c_root' },
    );
  });

  // -------- findAll --------
  it('findAll() returns categories ordered by name', async () => {
    (prismaMock.category.findMany as any).mockResolvedValue([root, child]);
    const res = await service.findAll();
    expect(prismaMock.category.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
    expect(res).toEqual([root, child]);
  });

  // -------- findOne --------
  it('findOne() returns a category by id', async () => {
    (prismaMock.category.findUnique as any).mockResolvedValue(root);
    const res = await service.findOne('c_root');
    expect(prismaMock.category.findUnique).toHaveBeenCalledWith({ where: { id: 'c_root' } });
    expect(res).toEqual(root);
  });

  // -------- getTree --------
  it('getTree() returns nested roots with children', async () => {
    // Service selects: id, name, slug, parentId, isLeaf
    (prismaMock.category.findMany as any).mockResolvedValue([
      root,
      child,
      {
        id: 'c_other_root',
        name: 'Snacks',
        slug: 'snacks',
        isLeaf: false,
        parentId: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const tree = await service.getTree();

    // Two roots expected
    expect(Array.isArray(tree)).toBe(true);
    const beverages = tree.find((n: any) => n.id === 'c_root');
    const snacks = tree.find((n: any) => n.id === 'c_other_root');

    expect(beverages).toBeDefined();
    expect(snacks).toBeDefined();
    expect(beverages.children).toBeDefined();
    expect(beverages.children.length).toBe(1);
    expect(beverages.children[0]).toMatchObject({
      id: 'c_child',
      name: 'Tea',
      parentId: 'c_root',
      children: [],
    });
    expect(snacks.children).toEqual([]);
  });

  // -------- update (no parent change) --------
  it('update() updates but does not rebuild paths when parentId unchanged or absent', async () => {
    (prismaMock.category.findUnique as any).mockResolvedValue({ id: 'c_child', parentId: 'c_root' });
    (prismaMock.category.update as any).mockResolvedValue({ ...child, name: 'Tea (Updated)' });

    const res = await service.update('c_child', { name: 'Tea (Updated)' });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.category.update).toHaveBeenCalledWith({
      where: { id: 'c_child' },
      data: { name: 'Tea (Updated)' },
    });
    expect(pathSvcMock.rebuildSubtreePaths).not.toHaveBeenCalled();
    expect(res.name).toBe('Tea (Updated)');
  });

  // -------- update (parent change) --------
  it('update() rebuilds subtree paths when parentId changes', async () => {
    (prismaMock.category.findUnique as any).mockResolvedValue({ id: 'c_child', parentId: 'c_root' });
    (prismaMock.category.update as any).mockResolvedValue({ ...child, parentId: 'c_new_root' });

    const res = await service.update('c_child', { parentId: 'c_new_root' });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.category.update).toHaveBeenCalledWith({
      where: { id: 'c_child' },
      data: { parentId: 'c_new_root' },
    });
    expect(pathSvcMock.rebuildSubtreePaths).toHaveBeenCalledTimes(1);
    expect(pathSvcMock.rebuildSubtreePaths).toHaveBeenCalledWith(
      prismaMock as any,
      'c_child',
      'c_new_root',
    );
    expect(res.parentId).toBe('c_new_root');
  });

  // -------- update (not found) --------
  it('update() throws NotFound when category does not exist', async () => {
    (prismaMock.category.findUnique as any).mockResolvedValue(null);
    await expect(service.update('missing', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaMock.category.update).not.toHaveBeenCalled();
  });

  // -------- remove --------
  it('remove() deletes and returns ok', async () => {
    (prismaMock.category.delete as any).mockResolvedValue(root);
    const res = await service.remove('c_root');
    expect(prismaMock.category.delete).toHaveBeenCalledWith({ where: { id: 'c_root' } });
    expect(res).toEqual({ ok: true });
  });
});
