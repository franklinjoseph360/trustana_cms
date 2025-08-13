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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private toSlug(s: string) {
    return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // NEW: attribute + (optional) multi-category links, all in one transaction
  async create(dto: CreateAttributeDto) {
    const { name, slug, type = 'TEXT', isGlobal = false, categoryIds = [] } = dto;

    const finalSlug = slug && slug.length ? slug : this.toSlug(name);

    if (isGlobal && categoryIds.length) {
      throw new BadRequestException('Global attributes should not have direct category links');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (categoryIds.length) {
          const existing = await tx.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, isLeaf: true },
          });
          const found = new Set(existing.map((c) => c.id));
          const missing = categoryIds.filter((id) => !found.has(id));
          if (missing.length) {
            throw new BadRequestException(`Unknown categoryIds: ${missing.join(', ')}`);
          }

          const nonLeaf = existing.filter((c) => !c.isLeaf).map((c) => c.id);
          if (nonLeaf.length) {
            throw new BadRequestException(
              `Only leaf categories can be linked. Non-leaf: ${nonLeaf.join(', ')}`,
            );
          }
        }

        const attribute = await tx.attribute.create({
          data: { name, slug: finalSlug, type, isGlobal },
        });

        let linksCreated = 0;
        if (!isGlobal && categoryIds.length) {
          const { count } = await tx.categoryAttributeLink.createMany({
            data: [...new Set(categoryIds)].map((categoryId) => ({
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
        throw new ConflictException('Attribute with the same name or slug already exists');
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
    return this.prisma.attribute.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.attribute.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Response shape:
   * {
   *   items: [
   *     { id, name, slug, type, isGlobal, createdAt, updatedAt,
   *       productsInUse, productCount, categories:[{id,name,slug}], applicability?: [...] }
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

    // Applicability to selected categories (global OR linked via ancestry)
    const applicableWhere: Prisma.AttributeWhereInput =
      categoryIds?.length
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
                          depth: { gte: 0 },
                        },
                      },
                    },
                  },
                },
              },
            ],
          }
        : {};

    // Build final where clause
    let where: Prisma.AttributeWhereInput = textWhere;

    if (categoryIds?.length) {
      // not-applicable → explicitly exclude all applicable ones
      if (linkTypes?.includes('not-applicable')) {
        where = { AND: [textWhere, { NOT: applicableWhere }] };
      } else {
        // Filter by specific link types among applicable
        const ors: Prisma.AttributeWhereInput[] = [];
        if (linkTypes?.includes('global')) {
          ors.push({ isGlobal: true });
        }
        if (linkTypes?.includes('direct')) {
          ors.push({
            links: {
              some: {
                category: {
                  parentPaths: { some: { childCategoryId: { in: categoryIds }, depth: 0 } },
                },
              },
            },
          });
        }
        if (linkTypes?.includes('inherited')) {
          ors.push({
            links: {
              some: {
                category: {
                  parentPaths: { some: { childCategoryId: { in: categoryIds }, depth: { gt: 0 } } },
                },
              },
            },
          });
        }

        // If specific link types selected, intersect with applicability
        // otherwise just "all applicable"
        where =
          ors.length > 0
            ? { AND: [textWhere, applicableWhere, { OR: ors }] }
            : { AND: [textWhere, applicableWhere] };
      }
    }

    // Query without array-batch $transaction to avoid prepared-statement clash
    const [total, pageItems] = await Promise.all([
      this.prisma.attribute.count({ where }),
      this.prisma.attribute.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          links: {
            include: { category: { select: { id: true, name: true, slug: true } } },
          },
          _count: { select: { values: true } },
        },
      }),
    ]);

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
        const rows: { categoryId: string; linkType: 'direct' | 'inherited' | 'global' | 'none'; depth?: number }[] =
          [];
        for (const cid of categoryIds) {
          if (a.isGlobal) {
            rows.push({ categoryId: cid, linkType: 'global' });
            continue;
          }
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
        applicabilityByAttr.set(a.id, rows);
      }
    }

    const filterCats = uniqueCatsFrom(pageItems);

    return {
      items: pageItems.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        type: a.type,
        isGlobal: a.isGlobal,
        createdAt: (a as any).createdAt ?? null,
        updatedAt: (a as any).updatedAt ?? null,
        // counts
        productCount: (a as any)._count?.values ?? 0,
        productsInUse: (a as any)._count?.values ?? 0,
        // categories
        categories: a.links.map((l) => l.category), // { id, name, slug }
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
  items: Array<{ links: Array<{ category: { id: string; name: string; slug: string } }> }>,
) {
  const map = new Map<string, { id: string; name: string; slug: string }>();
  for (const it of items) {
    for (const l of it.links) {
      map.set(l.category.id, l.category);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}
