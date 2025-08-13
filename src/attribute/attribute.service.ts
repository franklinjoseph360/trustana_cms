import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) { }

  private toSlug(s: string) {
    return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // Attribute + optional multi-category links, all in one transaction
  // Note: we no longer persist "isGlobal". Global == no CategoryAttributeLink rows.
  async create(dto: CreateAttributeDto) {
    const { name, slug, type = 'TEXT' } = dto as any;
    const categoryIds: string[] = Array.isArray((dto as any).categoryIds)
      ? Array.from(new Set((dto as any).categoryIds))
      : [];

    const finalSlug = slug && slug.length ? slug : this.toSlug(name);

    try {
      return await this.prisma.$transaction(async tx => {
        if (categoryIds.length) {
          // validate categories and leaf requirement
          const existing = await tx.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, isLeaf: true },
          });
          const found = new Set(existing.map(c => c.id));
          const missing = categoryIds.filter(id => !found.has(id));
          if (missing.length) {
            throw new BadRequestException(`Unknown categoryIds: ${missing.join(', ')}`);
          }
          const nonLeaf = existing.filter(c => !c.isLeaf).map(c => c.id);
          if (nonLeaf.length) {
            throw new BadRequestException(
              `Only leaf categories can be linked. Non-leaf: ${nonLeaf.join(', ')}`,
            );
          }
        }

        const attribute = await tx.attribute.create({
          data: { name, slug: finalSlug, type },
        });

        let linksCreated = 0;
        if (categoryIds.length) {
          const { count } = await tx.categoryAttributeLink.createMany({
            data: categoryIds.map(categoryId => ({
              categoryId,
              attributeId: attribute.id,
            })),
            skipDuplicates: true,
          });
          linksCreated = count;
        }

        return { attribute, linksCreated };
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Attribute with the same slug already exists');
      }
      throw e;
    }
  }

  findOne(id: string) {
    return this.prisma.attribute.findUnique({ where: { id } });
  }

  async update(id: string, dto: UpdateAttributeDto) {
    const exists = await this.prisma.attribute.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Attribute not found');
    // Remove any vestigial isGlobal from incoming DTO
    const { isGlobal, ...rest } = dto as any;
    return this.prisma.attribute.update({ where: { id }, data: rest });
  }

  async remove(id: string) {
    await this.prisma.attribute.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Response shape:
   * {
   *   items: [
   *     { id, name, slug, type, createdAt, updatedAt,
   *       productsInUse, categories:[{id,name,slug}], applicability?: [...] }
   *   ],
   *   total, page, pageSize,
   *   filters: { categories: [...], attributeTypes: ['direct','inherited','global'] }
   * }
   */
  async findAttributes(input: FindAttributesInput) {
    const { categoryIds, linkTypes, q, page, pageSize, sort } = input;

    const orderBy: Prisma.AttributeOrderByWithRelationInput =
      sort === 'name' ? { name: 'asc' } : sort === 'createdAt' ? { createdAt: 'asc' } : { updatedAt: 'asc' };

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Text search on name or slug
    const textWhere: Prisma.AttributeWhereInput = q?.trim()
      ? {
        OR: [
          { name: { contains: q.trim(), mode: 'insensitive' } },
          { slug: { contains: q.trim(), mode: 'insensitive' } },
        ],
      }
      : {};

    // Applicable to selected categories:
    // applicable = global (no links) OR linked to a selected node or its ancestors
    const applicableWhere: Prisma.AttributeWhereInput =
      categoryIds?.length
        ? {
          OR: [
            { categoryLinks: { none: {} } }, // global
            {
              categoryLinks: {
                some: {
                  category: {
                    parentPaths: {
                      some: {
                        childCategoryId: { in: categoryIds },
                        depth: { gte: 0 }, // 0 = direct, >0 = inherited
                      },
                    },
                  },
                },
              },
            },
          ],
        }
        : {};

    // Build link-type subfilters if requested
    const typeOrs: Prisma.AttributeWhereInput[] = [];
    if (categoryIds?.length) {
      if (linkTypes?.includes('global')) {
        typeOrs.push({ categoryLinks: { none: {} } });
      }
      if (linkTypes?.includes('direct')) {
        typeOrs.push({
          categoryLinks: {
            some: {
              category: {
                parentPaths: { some: { childCategoryId: { in: categoryIds }, depth: 0 } },
              },
            },
          },
        });
      }
      if (linkTypes?.includes('inherited')) {
        typeOrs.push({
          categoryLinks: {
            some: {
              category: {
                parentPaths: { some: { childCategoryId: { in: categoryIds }, depth: { gt: 0 } } },
              },
            },
          },
        });
      }
    }

    // Final where
    let where: Prisma.AttributeWhereInput = textWhere;
    if (categoryIds?.length) {
      if (linkTypes?.includes('not-applicable')) {
        where = { AND: [textWhere, { NOT: applicableWhere }] };
      } else {
        where =
          typeOrs.length > 0
            ? { AND: [textWhere, applicableWhere, { OR: typeOrs }] }
            : { AND: [textWhere, applicableWhere] };
      }
    }

    // Query (get global productsInUse via _count for the no-category case)
    const [total, pageItems] = await Promise.all([
      this.prisma.attribute.count({ where }),
      this.prisma.attribute.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          categoryLinks: {
            include: {
              category: { select: { id: true, name: true, slug: true } },
            },
          },
          _count: {
            select: {
              productLinks: true, // global count fallback
            },
          },
        },
      }),
    ]);

    // --- Compute productsInUse scoped to selected categories (and all their descendants) ---
    let scopedProductsInUse: Map<string, number> | undefined;

    if (categoryIds?.length) {
      // 1) Get descendant category ids for the selected roots (depth >= 0 includes the roots)
      const desc = await this.prisma.categoryTreePath.findMany({
        where: { parentCategoryId: { in: categoryIds }, depth: { gte: 0 } },
        select: { childCategoryId: true },
      });
      const scopeCategoryIds = new Set<string>([
        ...categoryIds,
        ...desc.map(d => d.childCategoryId),
      ]);

      // 2) Get all product ids inside that scope
      const scopedProducts = await this.prisma.product.findMany({
        where: { categoryId: { in: Array.from(scopeCategoryIds) } },
        select: { id: true },
      });
      const scopedProductIds = scopedProducts.map(p => p.id);

      // 3) Group ProductAttributeLink by attributeId restricted to those product ids
      scopedProductsInUse = new Map<string, number>();
      if (scopedProductIds.length) {
        const grouped = await this.prisma.productAttributeLink.groupBy({
          by: ['attributeId'],
          where: { productId: { in: scopedProductIds } },
          _count: { productId: true }, // 1 row per (productId, attributeId), so row count == products in use
        });
        for (const g of grouped) {
          scopedProductsInUse.set(g.attributeId, g._count.productId);
        }
      }
    }

    // Build applicability matrix only if categories were selected
    let applicabilityByAttr:
      | Map<string, { categoryId: string; linkType: 'direct' | 'inherited' | 'global' | 'none'; depth?: number }[]>
      | undefined;

    if (categoryIds?.length) {
      const paths = await this.prisma.categoryTreePath.findMany({
        where: { childCategoryId: { in: categoryIds } },
        select: { parentCategoryId: true, childCategoryId: true, depth: true },
      });

      const depthMatrix = new Map<string, Map<string, number>>();
      for (const p of paths) {
        let row = depthMatrix.get(p.childCategoryId);
        if (!row) {
          row = new Map();
          depthMatrix.set(p.childCategoryId, row);
        }
        const prev = row.get(p.parentCategoryId);
        row.set(p.parentCategoryId, prev === undefined ? p.depth : Math.min(prev, p.depth));
      }

      applicabilityByAttr = new Map();
      for (const a of pageItems) {
        const rows: { categoryId: string; linkType: 'direct' | 'inherited' | 'global' | 'none'; depth?: number }[] = [];
        const isGlobal = (a.categoryLinks?.length ?? 0) === 0;

        for (const cid of categoryIds) {
          if (isGlobal) {
            rows.push({ categoryId: cid, linkType: 'global' });
            continue;
          }
          const depthRow = depthMatrix.get(cid);
          let bestDepth: number | undefined;
          if (depthRow) {
            for (const link of a.categoryLinks) {
              const d = depthRow.get(link.categoryId);
              if (d !== undefined) bestDepth = bestDepth === undefined ? d : Math.min(bestDepth, d);
            }
          }
          if (bestDepth === undefined) rows.push({ categoryId: cid, linkType: 'none' });
          else rows.push({ categoryId: cid, linkType: bestDepth === 0 ? 'direct' : 'inherited', depth: bestDepth });
        }
        applicabilityByAttr.set(a.id, rows);
      }
    }

    const filterCats = uniqueCatsFrom(pageItems);

    return {
      items: pageItems.map(a => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        type: a.type,
        createdAt: (a as any).createdAt ?? null,
        updatedAt: (a as any).updatedAt ?? null,
        // counts
        productsInUse: scopedProductsInUse
          ? (scopedProductsInUse.get(a.id) ?? 0) // scoped to selected categories
          : (a as any)._count?.productLinks ?? 0, // global fallback
        // categories
        categories: a.categoryLinks.map(l => l.category),
        // applicability (only when categories were provided)
        applicability: categoryIds?.length ? applicabilityByAttr!.get(a.id) : undefined,
      })),
      total,
      page,
      pageSize,
      filters: {
        categories: filterCats,
        attributeTypes: ['direct', 'inherited', 'global'],
      },
    };
  }
}

// ---- helpers ----
function uniqueCatsFrom(
  items: Array<{ categoryLinks: Array<{ category: { id: string; name: string; slug: string } }> }>,
) {
  const map = new Map<string, { id: string; name: string; slug: string }>();
  for (const it of items) {
    for (const l of it.categoryLinks) {
      map.set(l.category.id, l.category);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}
