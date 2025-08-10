import { PrismaClient, AttributeType } from '@prisma/client';

type AttrDef = {
  slug: string;
  name: string;
  isGlobal?: boolean;
  type: AttributeType;
  linkToCategorySlugs?: string[];
};

const ATTRIBUTES: AttrDef[] = [
  // Globals
  { slug: 'sku',   name: 'SKU',   isGlobal: true, type: AttributeType.TEXT },
  { slug: 'brand', name: 'Brand', isGlobal: true, type: AttributeType.TEXT },
  { slug: 'gtin',  name: 'GTIN',  isGlobal: true, type: AttributeType.TEXT },
  { slug: 'mrp',   name: 'MRP',   isGlobal: true, type: AttributeType.NUMBER },

  // Beverages common
  { slug: 'volume-ml', name: 'Volume ml', type: AttributeType.NUMBER, linkToCategorySlugs: ['beverages', 'juices', 'soft-drinks', 'water'] },
  { slug: 'flavor',    name: 'Flavor',    type: AttributeType.TEXT,   linkToCategorySlugs: ['beverages', 'juices', 'soft-drinks'] },
  { slug: 'sugar-free', name: 'Sugar Free', type: AttributeType.BOOLEAN, linkToCategorySlugs: ['beverages', 'soft-drinks'] },

  // Coffee
  { slug: 'coffee-bean-type', name: 'Bean Type',        type: AttributeType.TEXT,   linkToCategorySlugs: ['coffee'] },
  { slug: 'coffee-roast',     name: 'Roast Level',      type: AttributeType.TEXT,   linkToCategorySlugs: ['coffee'] },
  { slug: 'coffee-grind',     name: 'Grind',            type: AttributeType.TEXT,   linkToCategorySlugs: ['coffee'] },
  { slug: 'coffee-origin',    name: 'Country of Origin',type: AttributeType.TEXT,   linkToCategorySlugs: ['coffee'] },
  { slug: 'caffeine-level',   name: 'Caffeine Level',   type: AttributeType.TEXT,   linkToCategorySlugs: ['coffee'] },
  { slug: 'pack-size-g',      name: 'Pack Size g',      type: AttributeType.NUMBER, linkToCategorySlugs: ['coffee'] },

  // Tea
  { slug: 'tea-type',        name: 'Tea Type',        type: AttributeType.TEXT,   linkToCategorySlugs: ['tea'] },
  { slug: 'tea-origin',      name: 'Country of Origin', type: AttributeType.TEXT, linkToCategorySlugs: ['tea'] },
  { slug: 'tea-pack-size-g', name: 'Pack Size g',     type: AttributeType.NUMBER, linkToCategorySlugs: ['tea'] },

  // Snacks
  { slug: 'net-weight-g', name: 'Net Weight g', type: AttributeType.NUMBER, linkToCategorySlugs: ['snacks', 'chips', 'biscuits-and-cookies', 'chocolate-and-confectionery', 'nuts-and-seeds'] },
  { slug: 'is-veg',       name: 'Vegetarian',   type: AttributeType.BOOLEAN, linkToCategorySlugs: ['snacks'] },
  { slug: 'allergens',    name: 'Allergens',    type: AttributeType.TEXT,    linkToCategorySlugs: ['snacks', 'biscuits-and-cookies', 'chocolate-and-confectionery', 'nuts-and-seeds'] },

  // Dairy and frozen
  { slug: 'fat-percentage', name: 'Fat Percentage', type: AttributeType.NUMBER, linkToCategorySlugs: ['milk', 'yogurt', 'cheese', 'butter-and-cream'] },
  { slug: 'storage',        name: 'Storage',        type: AttributeType.TEXT,   linkToCategorySlugs: ['dairy-and-eggs', 'frozen-and-ready-to-eat'] }, // parent for inheritance
];

export async function seedAttributes(prisma: PrismaClient) {
  console.log('Seeding attributes and category links');

  await prisma.$transaction(async tx => {
    // Upsert attributes by slug or name to avoid unique(name) conflicts
    const attrIdBySlug = new Map<string, string>();

    for (const def of ATTRIBUTES) {
      let existing = await tx.attribute.findUnique({
        where: { slug: def.slug },
        select: { id: true },
      });

      if (!existing) {
        const byName = await tx.attribute.findUnique({
          where: { name: def.name },
          select: { id: true },
        });

        if (byName) {
          const updated = await tx.attribute.update({
            where: { id: byName.id },
            data: {
              slug: def.slug,
              isGlobal: !!def.isGlobal,
              type: def.type,
            },
            select: { id: true },
          });
          existing = updated;
        }
      }

      if (!existing) {
        existing = await tx.attribute.create({
          data: {
            slug: def.slug,
            name: def.name,
            isGlobal: !!def.isGlobal,
            type: def.type,
          },
          select: { id: true },
        });
      } else {
        await tx.attribute.update({
          where: { id: existing.id },
          data: {
            name: def.name,
            isGlobal: !!def.isGlobal,
            type: def.type,
          },
        });
      }

      attrIdBySlug.set(def.slug, existing.id);
    }

    // Build category id map for all referenced slugs
    const categorySlugSet = new Set<string>();
    for (const def of ATTRIBUTES) {
      def.linkToCategorySlugs?.forEach(s => categorySlugSet.add(s));
    }
    const categorySlugs = Array.from(categorySlugSet);

    const categories = categorySlugs.length
      ? await tx.category.findMany({
          where: { slug: { in: categorySlugs } },
          select: { id: true, slug: true },
        })
      : [];

    const catIdBySlug = new Map(categories.map(c => [c.slug, c.id]));

    // Prepare link rows from definitions
    const linkRows: { categoryId: string; attributeId: string }[] = [];
    for (const def of ATTRIBUTES) {
      if (!def.linkToCategorySlugs?.length) continue;
      const attributeId = attrIdBySlug.get(def.slug)!;

      for (const slug of def.linkToCategorySlugs) {
        const categoryId = catIdBySlug.get(slug);
        if (!categoryId) {
          console.warn(`[seedAttributes] Category slug not found: ${slug}`);
          continue;
        }
        linkRows.push({ categoryId, attributeId });
      }
    }

    // Keep links in sync only for the attributes defined in this seed
    const linkedAttrIds = Array.from(
      new Set(
        ATTRIBUTES.filter(a => a.linkToCategorySlugs?.length).map(a => attrIdBySlug.get(a.slug)!),
      ),
    );
    if (linkedAttrIds.length) {
      await tx.categoryAttributeLink.deleteMany({
        where: { attributeId: { in: linkedAttrIds } },
      });
    }

    // Ensure global attributes have no links
    const globalAttrIds = ATTRIBUTES.filter(a => a.isGlobal).map(a => attrIdBySlug.get(a.slug)!);
    if (globalAttrIds.length) {
      await tx.categoryAttributeLink.deleteMany({
        where: { attributeId: { in: globalAttrIds } },
      });
    }

    if (linkRows.length) {
      await tx.categoryAttributeLink.createMany({
        data: linkRows,
        skipDuplicates: true,
      });
    }
  });

  console.log('Attributes and links seeded');
}
