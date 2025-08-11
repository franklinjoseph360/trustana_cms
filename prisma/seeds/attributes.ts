// prisma/seeds/attributes.ts
import { PrismaClient, AttributeType } from '@prisma/client'

type AttrDef = {
  slug: string
  name: string
  isGlobal?: boolean
  type: AttributeType
  linkToCategorySlugs?: string[]
}

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
  { slug: 'storage',        name: 'Storage',        type: AttributeType.TEXT,   linkToCategorySlugs: ['dairy-and-eggs', 'frozen-and-ready-to-eat'] },
]

export async function seedAttributes(prisma: PrismaClient) {
  console.log('Seeding attributes and category links')

  // 1. Upsert attributes sequentially and collect ids by slug
  const attrIdBySlug = new Map<string, string>()

  for (const def of ATTRIBUTES) {
    // prefer unique by slug
    let attr = await prisma.attribute.findUnique({
      where: { slug: def.slug },
      select: { id: true },
    })

    // if slug not present but name exists and is unique, adopt that record
    if (!attr) {
      const byName = await prisma.attribute.findUnique({
        where: { name: def.name },
        select: { id: true },
      })
      if (byName) {
        attr = await prisma.attribute.update({
          where: { id: byName.id },
          data: { slug: def.slug, isGlobal: !!def.isGlobal, type: def.type },
          select: { id: true },
        })
      }
    }

    if (!attr) {
      attr = await prisma.attribute.create({
        data: {
          slug: def.slug,
          name: def.name,
          isGlobal: !!def.isGlobal,
          type: def.type,
        },
        select: { id: true },
      })
    } else {
      await prisma.attribute.update({
        where: { id: attr.id },
        data: { name: def.name, isGlobal: !!def.isGlobal, type: def.type },
      })
    }

    attrIdBySlug.set(def.slug, attr.id)
  }

  // 2. Resolve category ids for all referenced slugs
  const categorySlugs = Array.from(
    new Set(ATTRIBUTES.flatMap(a => a.linkToCategorySlugs ?? [])),
  )

  const categories = categorySlugs.length
    ? await prisma.category.findMany({
        where: { slug: { in: categorySlugs } },
        select: { id: true, slug: true },
      })
    : []

  const catIdBySlug = new Map(categories.map(c => [c.slug, c.id]))

  // 3. Build desired link set
  const desiredLinks: { categoryId: string; attributeId: string }[] = []

  for (const def of ATTRIBUTES) {
    if (!def.linkToCategorySlugs?.length) continue
    const attributeId = attrIdBySlug.get(def.slug)
    if (!attributeId) continue

    for (const slug of def.linkToCategorySlugs) {
      const categoryId = catIdBySlug.get(slug)
      if (!categoryId) {
        console.warn(`[seedAttributes] category slug not found: ${slug}`)
        continue
      }
      desiredLinks.push({ categoryId, attributeId })
    }
  }

  // 4. Remove any existing links for attributes defined here, then insert desired set
  const allAttrIdsInThisSeed = Array.from(
    new Set(ATTRIBUTES.map(a => attrIdBySlug.get(a.slug)).filter(Boolean) as string[]),
  )

  if (allAttrIdsInThisSeed.length) {
    await prisma.categoryAttributeLink.deleteMany({
      where: { attributeId: { in: allAttrIdsInThisSeed } },
    })
  }

  if (desiredLinks.length) {
    await prisma.categoryAttributeLink.createMany({
      data: desiredLinks,
      skipDuplicates: true,
    })
  }

  // 5. Ensure global attributes have no category links at all
  const globalAttrIds = ATTRIBUTES.filter(a => a.isGlobal)
    .map(a => attrIdBySlug.get(a.slug))
    .filter(Boolean) as string[]

  if (globalAttrIds.length) {
    await prisma.categoryAttributeLink.deleteMany({
      where: { attributeId: { in: globalAttrIds } },
    })
  }

  console.log('Attributes and links seeded')
}
