// prisma/seeds/attributes.ts
import { PrismaClient, AttributeType } from '@prisma/client';

type AttrDef = {
  slug: string;
  name: string;
  // kept for intent only; we do not persist isGlobal in schema anymore
  isGlobal?: boolean;
  type: AttributeType;
  linkToCategorySlugs?: string[];
};

const ATTRIBUTES: AttrDef[] = [
  // Globals (no category links will be created for these)
  { slug: 'sku',   name: 'SKU',   isGlobal: true, type: AttributeType.TEXT },
  { slug: 'brand', name: 'Brand', isGlobal: true, type: AttributeType.TEXT },
  { slug: 'gtin',  name: 'GTIN',  isGlobal: true, type: AttributeType.TEXT },
  { slug: 'mrp',   name: 'MRP',   isGlobal: true, type: AttributeType.NUMBER },

  // Beverages common
  { slug: 'volume-ml', name: 'Volume ml', type: AttributeType.NUMBER, linkToCategorySlugs: ['beverages', 'juices', 'soft-drinks', 'water'] },
  { slug: 'flavor',    name: 'Flavor',    type: AttributeType.TEXT,   linkToCategorySlugs: ['beverages', 'juices', 'soft-drinks'] },
  { slug: 'sugar-free', name: 'Sugar Free', type: AttributeType.BOOLEAN, linkToCategorySlugs: ['beverages', 'soft-drinks'] },

  // Coffee
  { slug: 'coffee-bean-type', name: 'Bean Type',         type: AttributeType.TEXT,   linkToCategorySlugs: ['coffee'] },
  { slug: 'coffee-roast',     name: 'Roast Level',       type: AttributeType.TEXT,   linkToCategorySlugs: ['coffee'] },
  { slug: 'coffee-grind',     name: 'Grind',             type: AttributeType.TEXT,   linkToCategorySlugs: ['coffee'] },
  { slug: 'coffee-origin',    name: 'Country of Origin', type: AttributeType.TEXT,   linkToCategorySlugs: ['coffee'] },
  { slug: 'caffeine-level',   name: 'Caffeine Level',    type: AttributeType.TEXT,   linkToCategorySlugs: ['coffee'] },
  { slug: 'pack-size-g',      name: 'Pack Size g',       type: AttributeType.NUMBER, linkToCategorySlugs: ['coffee'] },

  // Tea
  { slug: 'tea-type',        name: 'Tea Type',         type: AttributeType.TEXT,   linkToCategorySlugs: ['tea'] },
  { slug: 'tea-origin',      name: 'Country of Origin',type: AttributeType.TEXT,   linkToCategorySlugs: ['tea'] },
  { slug: 'tea-pack-size-g', name: 'Pack Size g',      type: AttributeType.NUMBER, linkToCategorySlugs: ['tea'] },

  // Snacks
  { slug: 'net-weight-g', name: 'Net Weight g', type: AttributeType.NUMBER, linkToCategorySlugs: ['snacks', 'chips', 'biscuits-and-cookies', 'chocolate-and-confectionery', 'nuts-and-seeds'] },
  { slug: 'is-veg',       name: 'Vegetarian',   type: AttributeType.BOOLEAN, linkToCategorySlugs: ['snacks'] },
  { slug: 'allergens',    name: 'Allergens',    type: AttributeType.TEXT,    linkToCategorySlugs: ['snacks', 'biscuits-and-cookies', 'chocolate-and-confectionery', 'nuts-and-seeds'] },

  // Dairy and frozen
  { slug: 'fat-percentage', name: 'Fat Percentage', type: AttributeType.NUMBER, linkToCategorySlugs: ['milk', 'yogurt', 'cheese', 'butter-and-cream'] },
  { slug: 'storage',        name: 'Storage',        type: AttributeType.TEXT,   linkToCategorySlugs: ['dairy-and-eggs', 'frozen-and-ready-to-eat'] },
];

export async function seedAttributes(prisma: PrismaClient) {
  console.log('Seeding attributes and category links');

  await prisma.$transaction(async tx => {
    // 1. Upsert attributes by slug and collect ids
    const attrIdBySlug = new Map<string, string>();

    for (const def of ATTRIBUTES) {
      const upserted = await tx.attribute.upsert({
        where: { slug: def.slug },
        update: { name: def.name, type: def.type },
        create: { slug: def.slug, name: def.name, type: def.type },
        select: { id: true },
      });
      attrIdBySlug.set(def.slug, upserted.id);
    }

    // 2. Resolve category ids for all referenced slugs
    const categorySlugs = Array.from(
      new Set(ATTRIBUTES.flatMap(a => a.linkToCategorySlugs ?? [])),
    );

    const categories = categorySlugs.length
      ? await tx.category.findMany({
          where: { slug: { in: categorySlugs } },
          select: { id: true, slug: true, isLeaf: true },
        })
      : [];

    const catIdBySlug = new Map(categories.map(c => [c.slug, c.id]));

    // Warn if any referenced category is missing or not a leaf
    for (const slug of categorySlugs) {
      const cat = categories.find(c => c.slug === slug);
      if (!cat) console.warn(`[seedAttributes] category slug not found: ${slug}`);
      else if (!cat.isLeaf) console.warn(`[seedAttributes] category "${slug}" is not a leaf; links are expected to leaf categories`);
    }

    // 3. Build desired links, excluding global attributes
    const desiredLinks: { categoryId: string; attributeId: string }[] = [];

    for (const def of ATTRIBUTES) {
      if (def.isGlobal) continue; // globals have no links
      if (!def.linkToCategorySlugs?.length) continue;

      const attributeId = attrIdBySlug.get(def.slug);
      if (!attributeId) continue;

      for (const slug of def.linkToCategorySlugs) {
        const categoryId = catIdBySlug.get(slug);
        if (!categoryId) continue;
        desiredLinks.push({ categoryId, attributeId });
      }
    }

    // 4. Remove all existing links for attributes in this seed, then insert the desired set
    const allAttrIdsInThisSeed = Array.from(
      new Set(ATTRIBUTES.map(a => attrIdBySlug.get(a.slug)).filter(Boolean) as string[]),
    );

    if (allAttrIdsInThisSeed.length) {
      await tx.categoryAttributeLink.deleteMany({
        where: { attributeId: { in: allAttrIdsInThisSeed } },
      });
    }

    if (desiredLinks.length) {
      await tx.categoryAttributeLink.createMany({
        data: desiredLinks,
        skipDuplicates: true,
      });
    }

    console.log('Attributes and links seeded');
  });
}
