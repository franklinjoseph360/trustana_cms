import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type ListParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  categoryId?: string;
};

@Injectable()
export class ProductService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // --- helpers ---------------------------------------------------------------

  private async assertLeafCategory(categoryId: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, isLeaf: true },
    });
    if (!cat) throw new BadRequestException('Category does not exist');
    if (!cat.isLeaf) throw new BadRequestException('Product must be linked to a leaf category');
  }

  /** Keep ProductAttributeLink equal to the set of attributeIds currently used by this product */
  private async syncProductAttributeLinks(
    tx: Prisma.TransactionClient,
    productId: string,
    attributeIdsInUse: string[],
  ) {
    const current = await tx.productAttributeLink.findMany({
      where: { productId },
      select: { attributeId: true },
    });
    const currentSet = new Set(current.map(c => c.attributeId));
    const nextSet = new Set(attributeIdsInUse);

    const toInsert = [...nextSet].filter(a => !currentSet.has(a));
    const toDelete = [...currentSet].filter(a => !nextSet.has(a));

    if (toInsert.length) {
      await tx.productAttributeLink.createMany({
        data: toInsert.map(attributeId => ({ productId, attributeId })),
        skipDuplicates: true,
      });
    }
    if (toDelete.length) {
      await tx.productAttributeLink.deleteMany({
        where: { productId, attributeId: { in: toDelete } },
      });
    }
  }

  /** Resolve attributeSlug → attributeId in-place; returns the deduped list of attributeIds */
  private async resolveAttributeSlugs(
    tx: Prisma.TransactionClient,
    attributeValues?: Array<{ attributeId?: string; attributeSlug?: string; value?: any }>,
  ): Promise<string[]> {
    if (!attributeValues?.length) return [];

    const needSlugs = attributeValues
      .filter(v => !v.attributeId && v.attributeSlug)
      .map(v => v.attributeSlug!) as string[];

    if (needSlugs.length) {
      const found = await tx.attribute.findMany({
        where: { slug: { in: Array.from(new Set(needSlugs)) } },
        select: { id: true, slug: true },
      });
      const bySlug = new Map(found.map(a => [a.slug, a.id]));
      const missingSlugs = needSlugs.filter(s => !bySlug.has(s));
      if (missingSlugs.length) {
        throw new BadRequestException(`Unknown attribute slugs: ${missingSlugs.join(', ')}`);
      }
      // write resolved ids back
      for (const v of attributeValues) {
        if (!v.attributeId && v.attributeSlug) v.attributeId = bySlug.get(v.attributeSlug)!;
      }
    }

    // compile unique attributeIds list
    const attrIds = [...new Set(attributeValues.map(v => v.attributeId!).filter(Boolean))];
    if (!attrIds.length) return [];

    // ensure all exist
    const existing = await tx.attribute.findMany({ where: { id: { in: attrIds } }, select: { id: true } });
    const foundIds = new Set(existing.map(a => a.id));
    const missing = attrIds.filter(id => !foundIds.has(id));
    if (missing.length) throw new BadRequestException(`Unknown attributeIds: ${missing.join(', ')}`);

    return attrIds;
  }

  /** Check attributes are applicable to a category: global OR linked to category/ancestors */
  private async assertAttributesApplicable(
    tx: Prisma.TransactionClient,
    categoryId: string,
    attrIds: string[],
  ) {
    if (!attrIds.length) return;

    const globalIds = new Set(
      (
        await tx.attribute.findMany({
          where: { id: { in: attrIds }, categoryLinks: { none: {} } },
          select: { id: true },
        })
      ).map(a => a.id),
    );

    const applicableIds = new Set(
      (
        await tx.categoryAttributeLink.findMany({
          where: {
            attributeId: { in: attrIds },
            category: {
              parentPaths: {
                some: { childCategoryId: categoryId, depth: { gte: 0 } }, // 0=direct, >0=inherited
              },
            },
          },
          select: { attributeId: true },
        })
      ).map(x => x.attributeId),
    );

    const notApplicable = attrIds.filter(id => !globalIds.has(id) && !applicableIds.has(id));
    if (notApplicable.length) {
      throw new BadRequestException(
        `Attributes not applicable to category ${categoryId}: ${notApplicable.join(', ')}`,
      );
    }
  }

  // --- CRUD ------------------------------------------------------------------

  async create(dto: CreateProductDto) {
    await this.assertLeafCategory(dto.categoryId);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1) Create product
      const product = await tx.product.create({
        data: { name: dto.name, categoryId: dto.categoryId },
      });

      // 2) Ensure CategoryProductLink
      await tx.categoryProductLink.upsert({
        where: { categoryId_productId: { categoryId: product.categoryId, productId: product.id } },
        create: { categoryId: product.categoryId, productId: product.id },
        update: {},
      });

      // 3) Attributes (optional)
      if (dto.attributeValues?.length) {
        // resolve slugs, verify existence
        const attrIds = await this.resolveAttributeSlugs(tx, dto.attributeValues);

        // applicability: global or linked via tree to product.categoryId
        await this.assertAttributesApplicable(tx, product.categoryId, attrIds);

        // upsert values (map value fields if you added them)
        for (const v of dto.attributeValues) {
          if (!v.attributeId) continue;
          await tx.productAttributeValue.upsert({
            where: { productId_attributeId: { productId: product.id, attributeId: v.attributeId } },
            create: {
              productId: product.id,
              attributeId: v.attributeId,
              // textValue / numberValue / booleanValue / jsonValue: v.value
            },
            update: {
              // textValue / numberValue / booleanValue / jsonValue: v.value
            },
          });
        }

        // sync link table
        await this.syncProductAttributeLinks(tx, product.id, attrIds);
      }

      return product;
    });
  }

  findAll(params: ListParams = {}) {
    const { page = 1, pageSize = 25, q, categoryId } = params;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    return this.prisma.$transaction(async tx => {
      const where: Prisma.ProductWhereInput = {
        ...(q
          ? { name: { contains: q, mode: 'insensitive' } }
          : {}),
        ...(categoryId ? { categoryId } : {}),
      };

      const [items, total] = await Promise.all([
        tx.product.findMany({
          where,
          orderBy: { name: 'asc' },
          include: { category: true },
          skip,
          take,
        }),
        tx.product.count({ where }),
      ]);

      return { items, total, page, pageSize };
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const before = await this.prisma.product.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Product not found');

    if (dto.categoryId) await this.assertLeafCategory(dto.categoryId);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1) Update the product core fields
      const updated = await tx.product.update({
        where: { id },
        data: {
          name: dto.name ?? undefined,
          categoryId: dto.categoryId ?? undefined,
        },
      });

      // 2) Maintain CategoryProductLink if category changed
      if (dto.categoryId && dto.categoryId !== before.categoryId) {
        await tx.categoryProductLink.deleteMany({ where: { productId: id } });
        await tx.categoryProductLink.create({
          data: { categoryId: updated.categoryId, productId: id },
        });
      }

      // 3) If attributeValues provided, replace set
      if (dto.attributeValues) {
        // resolve slugs, verify existence
        const attrIds = await this.resolveAttributeSlugs(tx, dto.attributeValues);

        // applicability vs the *current* category (possibly updated above)
        await this.assertAttributesApplicable(tx, updated.categoryId, attrIds);

        // upsert/update provided values
        for (const v of dto.attributeValues) {
          if (!v.attributeId) continue;
          await tx.productAttributeValue.upsert({
            where: { productId_attributeId: { productId: id, attributeId: v.attributeId } },
            create: {
              productId: id,
              attributeId: v.attributeId,
              // textValue / numberValue / booleanValue / jsonValue: v.value
            },
            update: {
              // textValue / numberValue / booleanValue / jsonValue: v.value
            },
          });
        }

        // remove values not in the incoming set (treat as replacement)
        await tx.productAttributeValue.deleteMany({
          where: { productId: id, attributeId: { notIn: attrIds } },
        });

        // sync link table
        await this.syncProductAttributeLinks(tx, id, attrIds);
      }

      return updated;
    });
  }

  async remove(id: string) {
    // Clear dependents first to avoid FK errors
    await this.prisma.$transaction(async tx => {
      await tx.productAttributeLink.deleteMany({ where: { productId: id } });
      await tx.categoryProductLink.deleteMany({ where: { productId: id } });
      await tx.productAttributeValue.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
    });
    return { ok: true };
  }
}
