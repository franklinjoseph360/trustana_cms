import type { PrismaClient } from '@prisma/client'

type CatInput = {
  slug: string
  name: string
  children?: CatInput[]
}

const catalog: CatInput[] = [
  {
    slug: 'food-and-beverages',
    name: 'Food and Beverages',
    children: [
      {
        slug: 'beverages',
        name: 'Beverages',
        children: [
          { slug: 'coffee', name: 'Coffee' },
          { slug: 'tea', name: 'Tea' },
          { slug: 'juices', name: 'Juices' },
          { slug: 'soft-drinks', name: 'Soft Drinks' },
          { slug: 'water', name: 'Water' },
        ],
      },
      {
        slug: 'snacks',
        name: 'Snacks',
        children: [
          { slug: 'chips', name: 'Chips' },
          { slug: 'nuts-and-seeds', name: 'Nuts and Seeds' },
          { slug: 'biscuits-and-cookies', name: 'Biscuits and Cookies' },
          { slug: 'chocolate-and-confectionery', name: 'Chocolate and Confectionery' },
        ],
      },
      {
        slug: 'dairy-and-eggs',
        name: 'Dairy and Eggs',
        children: [
          { slug: 'milk', name: 'Milk' },
          { slug: 'yogurt', name: 'Yogurt' },
          { slug: 'cheese', name: 'Cheese' },
          { slug: 'eggs', name: 'Eggs' },
          { slug: 'butter-and-cream', name: 'Butter and Cream' },
        ],
      },
      {
        slug: 'bakery',
        name: 'Bakery',
        children: [
          { slug: 'bread', name: 'Bread' },
          { slug: 'buns-and-rolls', name: 'Buns and Rolls' },
          { slug: 'cakes-and-pastries', name: 'Cakes and Pastries' },
        ],
      },
      {
        slug: 'cooking-essentials',
        name: 'Cooking Essentials',
        children: [
          { slug: 'flour-and-grains', name: 'Flour and Grains' },
          { slug: 'rice-and-pulses', name: 'Rice and Pulses' },
          { slug: 'oils-and-ghee', name: 'Oils and Ghee' },
          { slug: 'spices-and-seasonings', name: 'Spices and Seasonings' },
          { slug: 'sauces-and-condiments', name: 'Sauces and Condiments' },
        ],
      },
      {
        slug: 'frozen-and-ready-to-eat',
        name: 'Frozen and Ready to Eat',
        children: [
          { slug: 'frozen-vegetables', name: 'Frozen Vegetables' },
          { slug: 'frozen-snacks', name: 'Frozen Snacks' },
          { slug: 'ready-meals', name: 'Ready Meals' },
          { slug: 'ice-cream', name: 'Ice Cream' },
        ],
      },
    ],
  },
]

export async function seedCategories(prisma: PrismaClient) {
  console.log('Seeding categories and paths')

  for (const root of catalog) {
    await upsertCategoryTreeWithPaths(prisma, root, null)
  }
}

async function upsertCategoryTreeWithPaths(
  prisma: PrismaClient,
  input: CatInput,
  parentId: string | null,
): Promise<string> {
  const hasChildren = Boolean(input.children?.length)

  const id = await upsertCategory(prisma, input, parentId, !hasChildren)
  await rebuildPathsForNode(prisma, id, parentId)

  if (hasChildren) {
    for (const child of input.children!) {
      await upsertCategoryTreeWithPaths(prisma, child, id)
    }
  }
  return id
}

async function upsertCategory(
  prisma: PrismaClient,
  input: CatInput,
  parentId: string | null,
  isLeaf: boolean,
): Promise<string> {
  if (parentId === null) {
    const existing = await prisma.category.findFirst({
      where: { slug: input.slug, parentId: null },
      select: { id: true },
    })
    if (existing) {
      const u = await prisma.category.update({
        where: { id: existing.id },
        data: { name: input.name, parentId: null, isLeaf },
        select: { id: true },
      })
      return u.id
    }
    const c = await prisma.category.create({
      data: { slug: input.slug, name: input.name, parentId: null, isLeaf },
      select: { id: true },
    })
    return c.id
  }

  const c = await prisma.category.upsert({
    where: { slug_parentId: { slug: input.slug, parentId } as any },
    update: { name: input.name, parentId, isLeaf },
    create: { slug: input.slug, name: input.name, parentId, isLeaf },
    select: { id: true },
  })
  return c.id
}

async function rebuildPathsForNode(
  prisma: PrismaClient,
  catId: string,
  parentId: string | null,
) {
  await prisma.categoryTreePath.deleteMany({ where: { childCategoryId: catId } })

  const rows: { parentCategoryId: string; childCategoryId: string; depth: number }[] = [
    { parentCategoryId: catId, childCategoryId: catId, depth: 0 },
  ]

  if (parentId) {
    const parentPaths = await prisma.categoryTreePath.findMany({
      where: { childCategoryId: parentId },
      select: { parentCategoryId: true, depth: true },
      orderBy: { depth: 'asc' },
    })
    for (const p of parentPaths) {
      rows.push({
        parentCategoryId: p.parentCategoryId,
        childCategoryId: catId,
        depth: p.depth + 1,
      })
    }
  }

  if (rows.length) {
    await prisma.categoryTreePath.createMany({ data: rows, skipDuplicates: true })
  }
}
