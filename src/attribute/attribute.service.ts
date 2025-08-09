import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { Prisma } from '@prisma/client';

type LinkType = 'direct' | 'inherited' | 'global' | 'not-applicable';

interface FindWithFiltersInput {
    categoryIds?: string[];
    linkTypes?: LinkType[]; // multi-select
    q?: string;
    page: number;
    pageSize: number;
    sort: 'name' | 'createdAt' | 'updatedAt';
}

@Injectable()
export class AttributeService {
    constructor(private readonly prisma: PrismaService) { }

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
     * - No categoryIds -> simple list (q/sort/pagination)
     * - With categoryIds -> applicable = global OR linked via ancestors/self
     * - linkTypes: 'direct'|'inherited'|'global'|'not-applicable' (multi)
     *   - If 'not-applicable' is present, it's treated exclusively (ignores others)
     */
    async findWithFilters(input: FindWithFiltersInput) {
        const { categoryIds, linkTypes, q, page, pageSize, sort } = input;

        const orderBy: Prisma.AttributeOrderByWithRelationInput =
            sort === 'name'
                ? { name: 'asc' }
                : sort === 'createdAt'
                    ? { createdAt: 'asc' }
                    : { updatedAt: 'asc' };

        const qClause: Prisma.AttributeWhereInput | undefined = q
            ? {
                OR: [
                    { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
                    { slug: { contains: q, mode: Prisma.QueryMode.insensitive } },
                ],
            }
            : undefined;

        // A) No category context → simple list
        if (!categoryIds?.length) {
            const where: Prisma.AttributeWhereInput = qClause ?? {};
            const [items, total] = await this.prisma.$transaction([
                this.prisma.attribute.findMany({
                    where,
                    orderBy,
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                }),
                this.prisma.attribute.count({ where }),
            ]);
            return { items, total, page, pageSize };
        }

        // Base applicability (global OR ancestor/self link)
        const applicableWhere: Prisma.AttributeWhereInput = {
            OR: [
                { isGlobal: true },
                {
                    links: {
                        some: {
                            category: {
                                parentPaths: {
                                    some: {
                                        childCategoryId: { in: categoryIds },
                                        depth: { gte: 0 }, // 0=direct, >0=inherited
                                    },
                                },
                            },
                        },
                    },
                },
            ],
        };

        // B) not-applicable → exclusive branch (no other linkTypes mixed)
        if (linkTypes?.includes('not-applicable')) {
            const applicableIds = await this.prisma.attribute.findMany({
                where: applicableWhere,
                select: { id: true },
            });
            const exclude = applicableIds.map(a => a.id);

            let whereClause: Prisma.AttributeWhereInput = { id: { notIn: exclude } };
            if (qClause) whereClause = { AND: [whereClause, qClause] };

            const [items, total] = await this.prisma.$transaction([
                this.prisma.attribute.findMany({
                    where: whereClause,
                    orderBy,
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                }),
                this.prisma.attribute.count({ where: whereClause }),
            ]);

            return { items, total, page, pageSize, meta: { linkTypes: ['not-applicable'] } };
        }

        // C) If specific linkTypes provided → add ONLY those refiners
        let whereClause: Prisma.AttributeWhereInput = applicableWhere;

        if (linkTypes && linkTypes.length > 0) {
            const refiners: Prisma.AttributeWhereInput[] = [];

            if (linkTypes.includes('global')) {
                refiners.push({ isGlobal: true });
            }
            if (linkTypes.includes('direct')) {
                refiners.push({
                    links: {
                        some: {
                            category: {
                                parentPaths: {
                                    some: { childCategoryId: { in: categoryIds }, depth: 0 },
                                },
                            },
                        },
                    },
                });
            }
            if (linkTypes.includes('inherited')) {
                refiners.push({
                    links: {
                        some: {
                            category: {
                                parentPaths: {
                                    some: { childCategoryId: { in: categoryIds }, depth: { gt: 0 } },
                                },
                            },
                        },
                    },
                });
            }

            // Only add OR refiners if any were requested
            if (refiners.length > 0) {
                whereClause = { AND: [applicableWhere, { OR: refiners }] };
            }
            // If linkTypes was an empty array, keep just applicableWhere (no refiners).
        }

        // Apply search if present
        if (qClause) {
            // If whereClause already has AND, append; otherwise start a new AND
            whereClause =
                'AND' in whereClause
                    ? { AND: [...(whereClause.AND as any[]), qClause] }
                    : { AND: [whereClause, qClause] };
        } else {
            // Ensure the structure matches tests when no q:
            // With no linkTypes → { AND: [ applicableWhere ] }
            // With linkTypes → already { AND: [ applicableWhere, { OR: refiners } ] }
            if (!('AND' in whereClause)) {
                whereClause = { AND: [whereClause] };
            }
        }

        const [items, total] = await this.prisma.$transaction([
            this.prisma.attribute.findMany({
                where: whereClause,
                orderBy,
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.attribute.count({ where: whereClause }),
        ]);

        return { items, total, page, pageSize };
    }
}
