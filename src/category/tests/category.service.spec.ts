import { Test, TestingModule } from '@nestjs/testing';
import { CategoryService } from '../category.service';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

describe('CategoryService', () => {
  let service: CategoryService;
  const now = new Date();

  const prismaMock = {
    category: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as unknown as PrismaService;

  const category = {
    id: 'c1',
    name: 'Beverages',
    slug: 'beverages',
    isLeaf: false,
    parentId: null,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  it('create() should call prisma.category.create', async () => {
    (prismaMock.category.create as any).mockResolvedValue(category);
    const res = await service.create({ name: 'Beverages', slug: 'beverages' });
    expect(prismaMock.category.create).toHaveBeenCalledWith({
      data: { name: 'Beverages', slug: 'beverages' },
    });
    expect(res).toEqual(category);
  });

  it('findAll() should return categories ordered by name', async () => {
    (prismaMock.category.findMany as any).mockResolvedValue([category]);
    const res = await service.findAll();
    expect(prismaMock.category.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    });
    expect(res).toEqual([category]);
  });

  it('findOne() should get a category by id', async () => {
    (prismaMock.category.findUnique as any).mockResolvedValue(category);
    const res = await service.findOne('c1');
    expect(prismaMock.category.findUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
    });
    expect(res).toEqual(category);
  });

  it('update() should update an existing category', async () => {
    (prismaMock.category.findUnique as any).mockResolvedValue(category);
    (prismaMock.category.update as any).mockResolvedValue({
      ...category,
      name: 'Drinks',
    });
    const res = await service.update('c1', { name: 'Drinks' });
    expect(prismaMock.category.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { name: 'Drinks' },
    });
    expect(res.name).toBe('Drinks');
  });

  it('update() should throw NotFound if category does not exist', async () => {
    (prismaMock.category.findUnique as any).mockResolvedValue(null);
    await expect(service.update('nope', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaMock.category.update).not.toHaveBeenCalled();
  });

  it('remove() should delete a category', async () => {
    (prismaMock.category.delete as any).mockResolvedValue(category);
    const res = await service.remove('c1');
    expect(prismaMock.category.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(res).toEqual({ ok: true });
  });
});
