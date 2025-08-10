import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';

type LinkType = 'direct' | 'inherited' | 'global' | 'not-applicable';

interface FindAttributesInput {
  categoryIds?: string[];
  linkTypes?: LinkType[]; // multi
  q?: string;
  page: number;
  pageSize: number;
  sort: 'name' | 'createdAt' | 'updatedAt';
}

@Injectable()
export class AttributeService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateAttributeDto) {
    return this.prisma.attribute.create({ data: dto });
  }
  findOne(id: string) {
    return this.prisma.attribute.findUnique({ where: { id } });
  }
  async update(id: string, dto: UpdateAttributeDto) {
    const exists = await this.prisma.attribute.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Attribute not found');
    return this.prisma.attribute.update({ where: { id }, data: dto });
  }
  async remove(id: string) {
    await this.prisma.attribute.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * - items: [{ id, name, slug, type, isGlobal, productCount, categories: [...], applicability?: [...] }]
   * - total, page, pageSize
   * - filters: { categories: [...], attributeTypes: ['direct','inherited','global'] }
   */
  async findAttributes(input: FindAttributesInput) {
    const { categoryIds, linkTypes, q, page, pageSize, sort } = input;

    const orderBy: Prisma.AttributeOrderByWithRelationInput =
      sort === 'name' ? { name: 'asc' } :
      sort === 'createdAt' ? { createdAt: 'asc' } :
      { updatedAt: 'asc' };

    const qClause: Prisma.AttributeWhereInput | undefined = q
      ? {
          OR: [
            { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { slug: { contains: q, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : undefined;

    // ---------- base applicability ----------
    const applicableWhere: Prisma.AttributeWhereInput = categoryIds?.length
      ? {
          OR: [
            { isGlobal: true },
            {
              links: {
                some: {
                  category: {
                    parentPaths: {
                      some: {
                        childCategoryId: { in: categoryIds },
                        depth: { gte: 0 }, // 0 direct, >0 inherited
                      },
                    },
                  },
                },
              },
            },
          ],
        }
      : {}; // when no categoryIds, list everything (subject to q)

    // ---------- linkTypes handling ----------
    // not-applicable is exclusive, return attributes NOT in applicable set
    if (categoryIds?.length && linkTypes?.includes('not-applicable')) {
      const applicableIds = await this.prisma.attribute.findMany({ where: applicableWhere, select: { id: true } });
      const exclude = applicableIds.map(a => a.id);
      let whereClause: Prisma.AttributeWhereInput = { id: { notIn: exclude } };
      if (qClause) whereClause = { AND: [whereClause, qClause] };

      const [pageItems, total] = await this.prisma.$transaction([
        this.prisma.attribute.findMany({
          where: whereClause,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            links: { include: { category: { select: { id: true, name: true, slug: true } } } },
            _count: { select: { values: true } },
          },
        }),
        this.prisma.attribute.count({ where: whereClause }),
      ]);

      // categories filter values from current page
      const filterCats = uniqueCatsFrom(pageItems);

      return {
        items: pageItems.map(a => ({
          id: a.id,
          name: a.name,
          slug: a.slug,
          type: a.type,
          isGlobal: a.isGlobal,
          productCount: a._count.values,
          categories: a.links.map(l => l.category),
          applicability: categoryIds.map(cid => ({ categoryId: cid, linkType: 'none' as const })),
        })),
        total, page, pageSize,
        filters: { categories: filterCats, attributeTypes: ['direct','inherited','global'] },
      };
    }

    // refiners for direct/inherited/global (if provided)
    let refinedWhere: Prisma.AttributeWhereInput =
      categoryIds?.length ? applicableWhere : (qClause ?? {});
    if (categoryIds?.length && linkTypes && linkTypes.length > 0) {
      const ORs: Prisma.AttributeWhereInput[] = [];
      if (linkTypes.includes('global')) ORs.push({ isGlobal: true });
      if (linkTypes.includes('direct')) {
        ORs.push({
          links: {
            some: {
              category: {
                parentPaths: { some: { childCategoryId: { in: categoryIds }, depth: 0 } },
              },
            },
          },
        });
      }
      if (linkTypes.includes('inherited')) {
        ORs.push({
          links: {
            some: {
              category: {
                parentPaths: { some: { childCategoryId: { in: categoryIds }, depth: { gt: 0 } } },
              },
            },
          },
        });
      }
      if (ORs.length) {
        refinedWhere = { AND: [applicableWhere, { OR: ORs }] };
      }
    }

    // add q to where
    if (qClause) {
      refinedWhere = 'AND' in refinedWhere
        ? { AND: [...(refinedWhere.AND as any[]), qClause] }
        : { AND: [refinedWhere, qClause] };
    } else if (!('AND' in refinedWhere) && (categoryIds?.length || Object.keys(refinedWhere).length)) {
      refinedWhere = { AND: [refinedWhere] };
    }

    // ---------- fetch page ----------
    const [pageItems, total] = await this.prisma.$transaction([
      this.prisma.attribute.findMany({
        where: refinedWhere,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          links: { include: { category: { select: { id: true, name: true, slug: true } } } },
          _count: { select: { values: true } }, // product usage count
        },
      }),
      this.prisma.attribute.count({ where: refinedWhere }),
    ]);

    // ---------- build applicability per selected category ----------
    let applicabilityByAttr: Map<string, { categoryId: string; linkType: 'direct' | 'inherited'; depth: number }[]> | undefined;

    if (categoryIds?.length) {
      // load all ancestor depths for provided categoryIds
      const paths = await this.prisma.categoryTreePath.findMany({
        where: { childCategoryId: { in: categoryIds } },
        select: { parentCategoryId: true, childCategoryId: true, depth: true },
      });

      // child -> (ancestor -> depth)
      const depthMatrix = new Map<string, Map<string, number>>();
      for (const p of paths) {
        let row = depthMatrix.get(p.childCategoryId);
        if (!row) { row = new Map(); depthMatrix.set(p.childCategoryId, row); }
        const prev = row.get(p.parentCategoryId);
        row.set(p.parentCategoryId, prev === undefined ? p.depth : Math.min(prev, p.depth));
      }

      applicabilityByAttr = new Map();

      for (const a of pageItems) {
        const rows: { categoryId: string; linkType: 'direct'|'inherited'|'global'|'none'; depth?: number }[] = [];
        for (const cid of categoryIds) {
          if (a.isGlobal) { rows.push({ categoryId: cid, linkType: 'global' }); continue; }
          const depthRow = depthMatrix.get(cid);
          let best: { depth: number } | undefined;
          if (depthRow) {
            for (const link of a.links) {
              const d = depthRow.get(link.categoryId);
              if (d !== undefined) best = !best || d < best.depth ? { depth: d } : best;
            }
          }
          if (!best) rows.push({ categoryId: cid, linkType: 'none' });
          else rows.push({ categoryId: cid, linkType: best.depth === 0 ? 'direct' : 'inherited', depth: best.depth });
        }
        applicabilityByAttr.set(a.id, rows as any);
      }
    }

    // ---------- filters payload for UI (from current page) ----------
    const filterCats = uniqueCatsFrom(pageItems);

    // ---------- final shape ----------
    return {
      items: pageItems.map(a => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        type: a.type,
        isGlobal: a.isGlobal,
        productCount: a._count.values,
        // all categories the attribute is directly linked to
        categories: a.links.map(l => l.category),
        // per-selected category applicability (only when categoryIds given)
        applicability: categoryIds?.length ? applicabilityByAttr!.get(a.id) : undefined,
      })),
      total, page, pageSize,
      filters: {
        categories: filterCats,
        attributeTypes: ['direct','inherited','global'],
      },
    };
  }
}

// ---- helpers ----
function uniqueCatsFrom(items: Array<{ links: Array<{ category: { id: string; name: string; slug: string } }> }>) {
  const map = new Map<string, { id: string; name: string; slug: string }>();
  for (const it of items) {
    for (const l of it.links) {
      map.set(l.category.id, l.category);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}
