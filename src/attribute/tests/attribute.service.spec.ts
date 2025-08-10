import { Test, TestingModule } from '@nestjs/testing';
import { AttributeService } from '../../attribute/attribute.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AttributeService.findAttributes', () => {
  let service: AttributeService;

  const prismaMock = {
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
    attribute: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    categoryTreePath: {
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const makeAttr = (over: Partial<any> = {}) => ({
    id: 'a1',
    name: 'Caffeine',
    slug: 'caffeine',
    type: 'NUMBER',
    isGlobal: false,
    links: [
      { categoryId: 'cat-tea', category: { id: 'cat-tea', name: 'Tea', slug: 'tea' } },
      { categoryId: 'cat-coffee', category: { id: 'cat-coffee', name: 'Coffee', slug: 'coffee' } },
    ],
    _count: { values: 25 },
    ...over,
  });

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

  it('A) no categoryIds → returns shape with categories[], productCount, type, pagination', async () => {
    (prismaMock.attribute.findMany as any).mockResolvedValueOnce([
      makeAttr(),
    ]);
    (prismaMock.attribute.count as any).mockResolvedValueOnce(1);

    const res = await service.findAttributes({
      page: 1, pageSize: 50, sort: 'name',
    });

    // verify prisma calls
    expect(prismaMock.attribute.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
      orderBy: { name: 'asc' },
      skip: 0,
      take: 50,
      include: {
        links: { include: { category: { select: { id: true, name: true, slug: true } } } },
        _count: { select: { values: true } },
      },
    }));

    // shape check
    expect(res).toEqual({
      items: [
        {
          id: 'a1',
          name: 'Caffeine',
          slug: 'caffeine',
          type: 'NUMBER',
          isGlobal: false,
          productCount: 25,
          categories: expect.any(Array), // Note: in "no categoryIds" case we set category: null earlier, but now we return categories[]
          applicability: undefined,      // not computed without categoryIds
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
      filters: expect.any(Object), // filters included in other branches; optional here
    });
  });

  it('B) with categoryIds (no linkTypes) → applicable; returns categories[] and applicability matrix', async () => {
    // main page query
    (prismaMock.attribute.findMany as any).mockResolvedValueOnce([
      makeAttr(),
    ]);
    (prismaMock.attribute.count as any).mockResolvedValueOnce(1);

    // ancestor depths for two selected nodes
    (prismaMock.categoryTreePath.findMany as any).mockResolvedValueOnce([
      // For c_leaf_a: Tea is depth 0, Coffee depth 1
      { childCategoryId: 'c_leaf_a', parentCategoryId: 'cat-tea', depth: 0 },
      { childCategoryId: 'c_leaf_a', parentCategoryId: 'cat-coffee', depth: 1 },
      // For c_leaf_b: Tea depth 2, Coffee not an ancestor
      { childCategoryId: 'c_leaf_b', parentCategoryId: 'cat-tea', depth: 2 },
    ]);

    const res = await service.findAttributes({
      categoryIds: ['c_leaf_a', 'c_leaf_b'],
      page: 1, pageSize: 20, sort: 'name',
    });

    // prisma where includes applicable (global OR ancestor-linked)
    const call = (prismaMock.attribute.findMany as any).mock.calls[0][0];
    expect(call.where.AND[0]).toEqual({
      OR: [
        { isGlobal: true },
        {
          links: {
            some: {
              category: {
                parentPaths: {
                  some: {
                    childCategoryId: { in: ['c_leaf_a','c_leaf_b'] },
                    depth: { gte: 0 },
                  },
                },
              },
            },
          },
        },
      ],
    });

    // result shaping
    expect(res.items[0]).toMatchObject({
      id: 'a1',
      name: 'Caffeine',
      type: 'NUMBER',
      productCount: 25,
      categories: [
        { id: 'cat-tea', name: 'Tea', slug: 'tea' },
        { id: 'cat-coffee', name: 'Coffee', slug: 'coffee' },
      ],
      applicability: [
        { categoryId: 'c_leaf_a', linkType: 'direct', depth: 0 },
        { categoryId: 'c_leaf_b', linkType: 'inherited', depth: 2 },
      ],
    });
  });

  it('C) with categoryIds + linkTypes=direct,inherited → adds OR refiners', async () => {
    (prismaMock.attribute.findMany as any).mockResolvedValueOnce([makeAttr()]);
    (prismaMock.attribute.count as any).mockResolvedValueOnce(1);
    (prismaMock.categoryTreePath.findMany as any).mockResolvedValueOnce([]);

    await service.findAttributes({
      categoryIds: ['cX'],
      linkTypes: ['direct','inherited'],
      page: 1, pageSize: 20, sort: 'name',
    });

    const call = (prismaMock.attribute.findMany as any).mock.calls[0][0];
    expect(call.where.AND[1]).toEqual({
      OR: [
        { links: { some: { category: { parentPaths: { some: { childCategoryId: { in: ['cX'] }, depth: 0 } } } } } },
        { links: { some: { category: { parentPaths: { some: { childCategoryId: { in: ['cX'] }, depth: { gt: 0 } } } } } } },
      ],
    });
  });

  it('D) not-applicable (exclusive) + q → returns items not in applicable set, with filters.categories', async () => {
    // first call to collect applicable ids
    (prismaMock.attribute.findMany as any).mockResolvedValueOnce([{ id: 'a1' }, { id: 'a2' }]);

    // transaction page
    (prismaMock.attribute.findMany as any).mockResolvedValueOnce([
      makeAttr({ id: 'a3', name: 'Decaf', links: [{ categoryId: 'cat-decaf', category: { id: 'cat-decaf', name: 'Decaf', slug: 'decaf' } }], _count: { values: 5 } }),
    ]);
    (prismaMock.attribute.count as any).mockResolvedValueOnce(1);

    const res = await service.findAttributes({
      categoryIds: ['c1'],
      linkTypes: ['not-applicable'],
      q: 'decaf',
      page: 2, pageSize: 10, sort: 'updatedAt',
    });

    // verify NOT IN where (second findMany)
    const secondCall = (prismaMock.attribute.findMany as any).mock.calls[1][0];
    expect(secondCall.where.AND[0].id.notIn).toEqual(['a1','a2']);
    expect(secondCall.orderBy).toEqual({ updatedAt: 'asc' });
    expect(secondCall.skip).toBe(10);
    expect(secondCall.take).toBe(10);

    // result includes filters.categories extracted from page
    expect(res.filters.categories).toEqual([{ id: 'cat-decaf', name: 'Decaf', slug: 'decaf' }]);
    expect(res.filters.attributeTypes).toEqual(['direct','inherited','global']);

    // shape
    expect(res.items[0]).toMatchObject({
      id: 'a3',
      name: 'Decaf',
      productCount: 5,
      categories: [{ id: 'cat-decaf', name: 'Decaf', slug: 'decaf' }],
      applicability: [
        { categoryId: 'c1', linkType: 'none' },
      ],
    });
  });

it('E) search and sort in no-category case', async () => {
  (prismaMock.attribute.findMany as any).mockResolvedValueOnce([makeAttr()]);
  (prismaMock.attribute.count as any).mockResolvedValueOnce(1);

  await service.findAttributes({
    q: 'caff',
    page: 1, pageSize: 25, sort: 'createdAt',
  });

  const call = (prismaMock.attribute.findMany as any).mock.calls[0][0];
  expect(call.orderBy).toEqual({ createdAt: 'asc' });
  expect(call.skip).toBe(0);
  expect(call.take).toBe(25);

  // tolerate { OR: [...] } or { AND: [ { OR: [...] } ] }
  const or =
    call.where?.OR ??
    (Array.isArray(call.where?.AND)
      ? call.where.AND.find((w: any) => w?.OR)?.OR
      : undefined);

  expect(Array.isArray(or)).toBe(true);
  expect(or![0].name.contains).toBe('caff');
  expect(or![1].slug.contains).toBe('caff');
});

});
