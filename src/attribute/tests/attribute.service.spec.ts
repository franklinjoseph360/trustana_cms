import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AttributeService } from '../attribute.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AttributeService', () => {
  let service: AttributeService;
  const now = new Date();

  const prismaMock = {
    attribute: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as unknown as PrismaService;

  const attr = {
    id: 'a1',
    name: 'Caffeine',
    slug: 'caffeine',
    isGlobal: false,
    type: 'NUMBER',
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributeService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(AttributeService);
  });

  it('create calls prisma.attribute.create', async () => {
    (prismaMock.attribute.create as any).mockResolvedValue(attr);
    const res = await service.create({ name: 'Caffeine', slug: 'caffeine', type: 'NUMBER', isGlobal: false });
    expect(prismaMock.attribute.create).toHaveBeenCalledWith({ data: { name: 'Caffeine', slug: 'caffeine', type: 'NUMBER', isGlobal: false } });
    expect(res).toEqual(attr);
  });

  it('findAll returns ordered list', async () => {
    (prismaMock.attribute.findMany as any).mockResolvedValue([attr]);
    const res = await service.findAll();
    expect(prismaMock.attribute.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
    expect(res).toEqual([attr]);
  });

  it('findOne returns by id', async () => {
    (prismaMock.attribute.findUnique as any).mockResolvedValue(attr);
    const res = await service.findOne('a1');
    expect(prismaMock.attribute.findUnique).toHaveBeenCalledWith({ where: { id: 'a1' } });
    expect(res).toEqual(attr);
  });

  it('update updates when exists', async () => {
    (prismaMock.attribute.findUnique as any).mockResolvedValue(attr);
    (prismaMock.attribute.update as any).mockResolvedValue({ ...attr, name: 'Caffeine mg' });
    const res = await service.update('a1', { name: 'Caffeine mg' });
    expect(prismaMock.attribute.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { name: 'Caffeine mg' } });
    expect(res.name).toBe('Caffeine mg');
  });

  it('update throws when not found', async () => {
    (prismaMock.attribute.findUnique as any).mockResolvedValue(null);
    await expect(service.update('nope', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove deletes', async () => {
    (prismaMock.attribute.delete as any).mockResolvedValue(attr);
    const res = await service.remove('a1');
    expect(prismaMock.attribute.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
    expect(res).toEqual({ ok: true });
  });
});
