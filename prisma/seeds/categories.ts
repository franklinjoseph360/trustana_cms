// prisma/seeds/categories.ts
import type { PrismaClient, Prisma } from '@prisma/client'

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
  console.log('→ Seeding categories and tree paths')
  for (const root of catalog) {
    const rootId = await upsertCategoryTreeWithPaths(prisma, root, null)
    console.log(`  • Upserted root '${root.slug}' id=${rootId}`)
  }
  console.log('✓ Category seed complete')
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

/**
 * Upserts a single category. For non-roots, uses the composite unique (slug,parentId).
 * For roots (parentId=null), we cannot rely on composites with NULL, so do an update-or-create.
 */
async function upsertCategory(
  prisma: PrismaClient,
  input: CatInput,
  parentId: string | null,
  isLeaf: boolean,
): Promise<string> {
  if (parentId === null) {
    // Root category (parentId null): manually update-or-create to avoid NULL composite-unique quirks
    const existing = await prisma.category.findFirst({
      where: { slug: input.slug, parentId: null },
      select: { id: true },
    })

    if (existing) {
      const updated = await prisma.category.update({
        where: { id: existing.id },
        data: { name: input.name, parentId: null, isLeaf },
        select: { id: true },
      })
      return updated.id
    }

    const created = await prisma.category.create({
      data: { slug: input.slug, name: input.name, parentId: null, isLeaf },
      select: { id: true },
    })
    return created.id
  }

  // Non-root: rely on composite unique on (slug, parentId)
  const res = await prisma.category.upsert({
    where: { slug_parentId: { slug: input.slug, parentId } }, // requires @@unique([slug, parentId]) in Prisma schema
    update: { name: input.name, isLeaf, parentId },
    create: { slug: input.slug, name: input.name, isLeaf, parentId },
    select: { id: true },
  })
  return res.id
}

/**
 * Rebuilds the closure-table paths for a node:
 *  - delete all existing rows where child = this node
 *  - insert self-path (depth 0)
 *  - insert all ancestor paths derived from parent's paths
 * Done inside a transaction for atomicity.
 */
async function rebuildPathsForNode(
  prisma: PrismaClient,
  catId: string,
  parentId: string | null,
) {
  await prisma.$transaction(async (tx) => {
    // remove old paths for this child
    await tx.categoryTreePath.deleteMany({ where: { childCategoryId: catId } })

    // always include self (depth 0)
    const rows: Prisma.CategoryTreePathCreateManyInput[] = [
      { parentCategoryId: catId, childCategoryId: catId, depth: 0 },
    ]

    if (parentId) {
      const parentPaths = await tx.categoryTreePath.findMany({
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
      await tx.categoryTreePath.createMany({ data: rows, skipDuplicates: true })
    }
  })
}
