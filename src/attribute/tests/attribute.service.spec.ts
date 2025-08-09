import { Test, TestingModule } from '@nestjs/testing';
import { AttributeService } from '../../attribute/attribute.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AttributeService.findWithFilters (pure Prisma)', () => {
  let service: AttributeService;

  // Prisma mock
  const prismaMock = {
    $transaction: jest.fn(async (ops: any[]) => {
      // ops are already-evaluated Promises from findMany/count,
      // so just await them in order and return as Prisma would.
      const results = await Promise.all(ops);
      return results;
    }),
    attribute: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributeService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AttributeService>(AttributeService);
  });

  it('A) no categoryIds → simple list, default paging/sort', async () => {
    (prismaMock.attribute.findMany as any).mockResolvedValueOnce([]); // items
    (prismaMock.attribute.count as any).mockResolvedValueOnce(0);     // total

    const res = await service.findWithFilters({
      page: 1,
      pageSize: 50,
      sort: 'name',
    });

    expect(prismaMock.attribute.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { name: 'asc' },
      skip: 0,
      take: 50,
    });
    expect(prismaMock.attribute.count).toHaveBeenCalledWith({ where: {} });
    expect(res).toEqual({ items: [], total: 0, page: 1, pageSize: 50 });
  });

  it('B) no categoryIds + q → applies case-insensitive search', async () => {
    (prismaMock.attribute.findMany as any).mockResolvedValueOnce([]);
    (prismaMock.attribute.count as any).mockResolvedValueOnce(0);

    await service.findWithFilters({
      q: 'tea',
      page: 2,
      pageSize: 10,
      sort: 'createdAt',
    });

    const call = (prismaMock.attribute.findMany as any).mock.calls[0][0];
    expect(call.orderBy).toEqual({ createdAt: 'asc' });
    expect(call.skip).toBe(10); // (page-1)*pageSize
    expect(call.take).toBe(10);
    // verify OR search clause exists
    expect(call.where.OR).toBeDefined();
    expect(call.where.OR.length).toBe(2);
    expect(call.where.OR[0].name.contains).toBe('tea');
    expect(call.where.OR[1].slug.contains).toBe('tea');
  });

  it('C) with categoryIds (no linkTypes) → applicable (global OR ancestor-linked)', async () => {
    (prismaMock.attribute.findMany as any).mockResolvedValueOnce([]);
    (prismaMock.attribute.count as any).mockResolvedValueOnce(0);

    const categoryIds = ['c1', 'c2'];
    await service.findWithFilters({
      categoryIds,
      page: 1,
      pageSize: 20,
      sort: 'name',
    });

    const call = (prismaMock.attribute.findMany as any).mock.calls[0][0];
    expect(call.orderBy).toEqual({ name: 'asc' });
    // applicableWhere only (no refiners)
    expect(call.where).toEqual({
      AND: [
        {
          OR: [
            { isGlobal: true },
            {
              links: {
                some: {
                  category: {
                    parentPaths: {
                      some: {
                        childCategoryId: { in: categoryIds },
                        depth: { gte: 0 },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    });
  });

  it('D) with categoryIds + linkTypes=direct,inherited → adds OR refiners', async () => {
    (prismaMock.attribute.findMany as any).mockResolvedValueOnce([]);
    (prismaMock.attribute.count as any).mockResolvedValueOnce(0);

    const categoryIds = ['cX'];
    await service.findWithFilters({
      categoryIds,
      linkTypes: ['direct', 'inherited'],
      page: 1,
      pageSize: 20,
      sort: 'name',
    });

    const call = (prismaMock.attribute.findMany as any).mock.calls[0][0];
    // Structure: AND [ applicableWhere, { OR: [directRef, inheritedRef] } ]
    expect(call.where.AND[1]).toEqual({
      OR: [
        {
          links: {
            some: {
              category: {
                parentPaths: {
                  some: { childCategoryId: { in: categoryIds }, depth: 0 },
                },
              },
            },
          },
        },
        {
          links: {
            some: {
              category: {
                parentPaths: {
                  some: { childCategoryId: { in: categoryIds }, depth: { gt: 0 } },
                },
              },
            },
          },
        },
      ],
    });
  });

  it('E) with categoryIds + linkTypes=global only → refines to isGlobal', async () => {
    (prismaMock.attribute.findMany as any).mockResolvedValueOnce([]);
    (prismaMock.attribute.count as any).mockResolvedValueOnce(0);

    const categoryIds = ['c1'];
    await service.findWithFilters({
      categoryIds,
      linkTypes: ['global'],
      page: 1,
      pageSize: 20,
      sort: 'name',
    });

    const call = (prismaMock.attribute.findMany as any).mock.calls[0][0];
    expect(call.where.AND[1]).toEqual({ OR: [{ isGlobal: true }] });
  });

  it('F) with categoryIds + linkTypes includes not-applicable (exclusive) + q', async () => {
    // First call: collect applicable IDs
    (prismaMock.attribute.findMany as any).mockResolvedValueOnce([{ id: 'a1' }, { id: 'a2' }]);
    // Transaction: second findMany returns items; count returns total
    (prismaMock.attribute.findMany as any).mockResolvedValueOnce([{ id: 'a3' }]);
    (prismaMock.attribute.count as any).mockResolvedValueOnce(1);

    const categoryIds = ['c1'];
    const res = await service.findWithFilters({
      categoryIds,
      linkTypes: ['not-applicable'],
      q: 'decaf',
      page: 3,
      pageSize: 5,
      sort: 'updatedAt',
    });

    // First findMany (collect applicable IDs)
    expect((prismaMock.attribute.findMany as any).mock.calls[0][0]).toMatchObject({
      where: {
        OR: [
          { isGlobal: true },
          {
            links: {
              some: {
                category: {
                  parentPaths: {
                    some: { childCategoryId: { in: categoryIds }, depth: { gte: 0 } },
                  },
                },
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    // Transactioned find/count on NOT IN and search
    const txFindCall = (prismaMock.attribute.findMany as any).mock.calls[1][0];
    expect(txFindCall.where.AND[0].id.notIn).toEqual(['a1', 'a2']);
    // qClause applied
    expect(txFindCall.where.AND[1].OR[0].name.contains).toBe('decaf');
    expect(txFindCall.where.AND[1].OR[1].slug.contains).toBe('decaf');
    expect(txFindCall.orderBy).toEqual({ updatedAt: 'asc' });
    expect(txFindCall.skip).toBe(10); // (3-1)*5
    expect(txFindCall.take).toBe(5);

    expect(res).toEqual({
      items: [{ id: 'a3' }],
      total: 1,
      page: 3,
      pageSize: 5,
      meta: { linkTypes: ['not-applicable'] },
    });
  });
});
