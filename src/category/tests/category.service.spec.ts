import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CategoryTreePathService } from '../../category-tree-path/category-tree-path.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoryService } from '../category.service';

describe('CategoryService', () => {
  let service: CategoryService;

  const now = new Date();

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

  // --- Path service mock ---
  const pathSvcMock = {
    addPathsForNewCategory: jest.fn(),
    rebuildSubtreePaths: jest.fn(),
  } as unknown as CategoryTreePathService;

  const categoryBefore = {
    id: 'c1',
    name: 'Tea',
    slug: 'tea',
    isLeaf: false,
    parentId: null as string | null,
    createdAt: now,
    updatedAt: now,
  };

  const createdCategory = {
    id: 'c2',
    name: 'Green Tea',
    slug: 'green-tea',
    isLeaf: true,
    parentId: 'c1',
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

  // ---------- create ----------
  it('create() should create category and add paths in one transaction', async () => {
    (prismaMock.category.create as any).mockResolvedValue(createdCategory);

    await service.create({
      name: 'Green Tea',
      slug: 'green-tea',
      isLeaf: true,
      parentId: 'c1',
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.category.create).toHaveBeenCalledWith({
      data: { name: 'Green Tea', slug: 'green-tea', isLeaf: true, parentId: 'c1' },
    });
    expect(pathSvcMock.addPathsForNewCategory).toHaveBeenCalledTimes(1);
    // first arg is the "tx" passed by $transaction — here we reuse prismaMock
    expect(pathSvcMock.addPathsForNewCategory).toHaveBeenCalledWith(
      prismaMock as any,
      { id: createdCategory.id, parentId: createdCategory.parentId },
    );
  });

  // ---------- findAll ----------
  it('findAll() should return categories ordered by name', async () => {
    (prismaMock.category.findMany as any).mockResolvedValue([categoryBefore]);
    const res = await service.findAll();
    expect(prismaMock.category.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
    expect(res).toEqual([categoryBefore]);
  });

  // ---------- findOne ----------
  it('findOne() should return a category by id', async () => {
    (prismaMock.category.findUnique as any).mockResolvedValue(categoryBefore);
    const res = await service.findOne('c1');
    expect(prismaMock.category.findUnique).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(res).toEqual(categoryBefore);
  });

  // ---------- update (no parent change) ----------
  it('update() should update and NOT rebuild paths when parentId unchanged or not provided', async () => {
    (prismaMock.category.findUnique as any).mockResolvedValue({ id: 'c2', parentId: 'c1' });
    (prismaMock.category.update as any).mockResolvedValue({ ...createdCategory, name: 'Updated' });

    const res = await service.update('c2', { name: 'Updated' }); // no parentId in DTO

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.category.update).toHaveBeenCalledWith({
      where: { id: 'c2' },
      data: { name: 'Updated' },
    });
    expect(pathSvcMock.rebuildSubtreePaths).not.toHaveBeenCalled();
    expect(res.name).toBe('Updated');
  });

  // ---------- update (parent change) ----------
  it('update() should rebuild subtree paths when parentId changes', async () => {
    (prismaMock.category.findUnique as any).mockResolvedValue({ id: 'c2', parentId: 'c1' });
    (prismaMock.category.update as any).mockResolvedValue({ ...createdCategory, parentId: 'c-root' });

    const res = await service.update('c2', { parentId: 'c-root' });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.category.update).toHaveBeenCalledWith({
      where: { id: 'c2' },
      data: { parentId: 'c-root' },
    });
    expect(pathSvcMock.rebuildSubtreePaths).toHaveBeenCalledTimes(1);
    expect(pathSvcMock.rebuildSubtreePaths).toHaveBeenCalledWith(
      prismaMock as any,
      'c2',
      'c-root',
    );
    expect(res.parentId).toBe('c-root');
  });

  // ---------- update (not found) ----------
  it('update() should throw NotFound when category does not exist', async () => {
    (prismaMock.category.findUnique as any).mockResolvedValue(null);

    await expect(service.update('missing', { name: 'X' }))
      .rejects
      .toBeInstanceOf(NotFoundException);

    expect(prismaMock.category.update).not.toHaveBeenCalled();
  });

  // ---------- remove ----------
  it('remove() should delete a category and return ok', async () => {
    (prismaMock.category.delete as any).mockResolvedValue(categoryBefore);
    const res = await service.remove('c1');
    expect(prismaMock.category.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(res).toEqual({ ok: true });
  });
});
