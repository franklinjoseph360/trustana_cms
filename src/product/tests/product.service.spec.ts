import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductService } from '../product.service';

describe('ProductService', () => {
  let service: ProductService;

  const now = new Date();

  const prismaMock = {
    category: {
      findUnique: jest.fn(),
    },
    product: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as unknown as PrismaService;

  const product = {
    id: 'p1',
    name: 'Jasmine Green Tea',
    categoryId: 'c-leaf',
    createdAt: now,
    updatedAt: now,
    category: { id: 'c-leaf', name: 'Green Tea', isLeaf: true, parentId: 'c2', slug: 'green-tea', createdAt: now, updatedAt: now },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(ProductService);
  });

  describe('create', () => {
    it('creates when category is leaf', async () => {
      (prismaMock.category.findUnique as any).mockResolvedValue({ id: 'c-leaf', isLeaf: true });
      (prismaMock.product.create as any).mockResolvedValue(product);

      const res = await service.create({ name: 'Jasmine Green Tea', categoryId: 'c-leaf' });

      expect(prismaMock.category.findUnique).toHaveBeenCalledWith({ where: { id: 'c-leaf' }, select: { id: true, isLeaf: true } });
      expect(prismaMock.product.create).toHaveBeenCalledWith({ data: { name: 'Jasmine Green Tea', categoryId: 'c-leaf' } });
      expect(res).toEqual(product);
    });

    it('throws when category does not exist', async () => {
      (prismaMock.category.findUnique as any).mockResolvedValue(null);
      await expect(service.create({ name: 'X', categoryId: 'missing' })).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.product.create).not.toHaveBeenCalled();
    });

    it('throws when category is not leaf', async () => {
      (prismaMock.category.findUnique as any).mockResolvedValue({ id: 'c-parent', isLeaf: false });
      await expect(service.create({ name: 'X', categoryId: 'c-parent' })).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.product.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns products with category', async () => {
      (prismaMock.product.findMany as any).mockResolvedValue([product]);
      const res = await service.findAll();
      expect(prismaMock.product.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' }, include: { category: true } });
      expect(res).toEqual([product]);
    });
  });

  describe('findOne', () => {
    it('returns a product', async () => {
      (prismaMock.product.findUnique as any).mockResolvedValue(product);
      const res = await service.findOne('p1');
      expect(prismaMock.product.findUnique).toHaveBeenCalledWith({ where: { id: 'p1' }, include: { category: true } });
      expect(res).toEqual(product);
    });

    it('throws when not found', async () => {
      (prismaMock.product.findUnique as any).mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates name only', async () => {
      (prismaMock.product.findUnique as any).mockResolvedValue(product);
      (prismaMock.product.update as any).mockResolvedValue({ ...product, name: 'Updated' });

      const res = await service.update('p1', { name: 'Updated' });

      expect(prismaMock.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { name: 'Updated' } });
      expect(res.name).toBe('Updated');
    });

    it('validates leaf when categoryId changes', async () => {
      (prismaMock.product.findUnique as any).mockResolvedValue(product);
      (prismaMock.category.findUnique as any).mockResolvedValue({ id: 'c-leaf-2', isLeaf: true });
      (prismaMock.product.update as any).mockResolvedValue({ ...product, categoryId: 'c-leaf-2' });

      const res = await service.update('p1', { categoryId: 'c-leaf-2' });

      expect(prismaMock.category.findUnique).toHaveBeenCalledWith({ where: { id: 'c-leaf-2' }, select: { id: true, isLeaf: true } });
      expect(res.categoryId).toBe('c-leaf-2');
    });

    it('throws on update if product not found', async () => {
      (prismaMock.product.findUnique as any).mockResolvedValue(null);
      await expect(service.update('missing', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes and returns ok', async () => {
      (prismaMock.product.delete as any).mockResolvedValue(product);
      const res = await service.remove('p1');
      expect(prismaMock.product.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
      expect(res).toEqual({ ok: true });
    });
  });
});
