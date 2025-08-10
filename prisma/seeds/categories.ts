// prisma/seeds/categories.ts
import { PrismaClient, Prisma } from '@prisma/client';

type CatInput = {
  slug: string;
  name: string;
  children?: CatInput[];
};

// Screen 2 + sensible children and leaves
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
];

export async function seedCategories(prisma: PrismaClient) {
  console.log('Seeding categories + CategoryTreePath');

  await prisma.$transaction(async tx => {
    for (const root of catalog) {
      await upsertCategoryTreeWithPaths(tx, root, null);
    }
  });

  console.log('Done seeding categories and paths');
}

/**
 * Upserts a category using the compound unique (slug, parentId),
 * sets isLeaf from children presence, rebuilds closure rows for the node,
 * then recurses for children.
 */
async function upsertCategoryTreeWithPaths(
  tx: Prisma.TransactionClient,
  input: CatInput,
  parentId: string | null,
): Promise<string> {
  const hasChildren = !!input.children?.length;

  // 1. Upsert category with nullable compound unique support
  let cat: { id: string };
  if (parentId === null) {
    // manual upsert for root categories
    const existing = await tx.category.findFirst({
      where: { slug: input.slug, parentId: null },
      select: { id: true },
    });

    if (existing) {
      cat = await tx.category.update({
        where: { id: existing.id },
        data: { name: input.name, parentId: null, isLeaf: !hasChildren },
        select: { id: true },
      });
    } else {
      cat = await tx.category.create({
        data: { slug: input.slug, name: input.name, parentId: null, isLeaf: !hasChildren },
        select: { id: true },
      });
    }
  } else {
    // safe to use the compound unique selector when parentId is not null
    cat = await tx.category.upsert({
      where: { slug_parentId: { slug: input.slug, parentId } },
      update: { name: input.name, parentId, isLeaf: !hasChildren },
      create: { slug: input.slug, name: input.name, parentId, isLeaf: !hasChildren },
      select: { id: true },
    });
  }

  // 2. Rebuild closure rows for this node
  await tx.categoryTreePath.deleteMany({ where: { childCategoryId: cat.id } });

  const rows: { parentCategoryId: string; childCategoryId: string; depth: number }[] = [
    { parentCategoryId: cat.id, childCategoryId: cat.id, depth: 0 },
  ];

  if (parentId) {
    const parentPaths = await tx.categoryTreePath.findMany({
      where: { childCategoryId: parentId },
      select: { parentCategoryId: true, depth: true },
      orderBy: { depth: 'asc' },
    });
    for (const p of parentPaths) {
      rows.push({
        parentCategoryId: p.parentCategoryId,
        childCategoryId: cat.id,
        depth: p.depth + 1,
      });
    }
  }

  await tx.categoryTreePath.createMany({ data: rows, skipDuplicates: true });

  // 3. Recurse
  if (hasChildren) {
    for (const child of input.children!) {
      await upsertCategoryTreeWithPaths(tx, child, cat.id);
    }
  }

  return cat.id;
}

