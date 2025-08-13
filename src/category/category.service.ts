import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryTreePathService } from '../category-tree-path/category-tree-path.service';
import { TreeNode } from './category.controller';

@Injectable()
export class CategoryService {
    constructor(
        @Inject(PrismaService) private readonly prisma: PrismaService,
        @Inject(CategoryTreePathService) private readonly pathSvc: CategoryTreePathService,
    ) { }

    //CREATE: add self row and ancestor paths in the same transaction
    async create(dto: CreateCategoryDto) {
        return this.prisma.$transaction(async (tx) => {
            const category = await tx.category.create({ data: dto });
            await this.pathSvc.addPathsForNewCategory(tx, {
                id: category.id,
                parentId: category.parentId ?? null,
            });
            return category;
        });
    }

    findAll() {
        return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
    }

    findOne(id: string) {
        return this.prisma.category.findUnique({ where: { id } });
    }

    async getTree(): Promise<TreeNode[]> {
        // 1) Fetch flat categories + direct attribute-link counts
        const rows = await this.prisma.category.findMany({
            orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
            select: {
                id: true,
                name: true,
                slug: true,
                parentId: true,
                isLeaf: true,
                _count: {
                    select: {
                        attributeLinks: true, // direct attribute links on this category
                    },
                },
            },
        });

        if (!rows.length) return [];

        // 2) Get direct product counts from CategoryProductLink in one grouped query
        const prodGroups = await this.prisma.categoryProductLink.groupBy({
            by: ['categoryId'],
            _count: { productId: true },
        });
        const productsByCategory = new Map<string, number>(
            prodGroups.map(g => [g.categoryId, g._count.productId]),
        );

        // 3) Map to nodes and stitch the tree
        const byId = new Map<string, TreeNode>();
        for (const r of rows) {
            byId.set(r.id, {
                id: r.id,
                name: r.name,
                slug: r.slug,
                parentId: r.parentId ?? null,
                isLeaf: r.isLeaf,
                counts: {
                    attributesDirect: r._count.attributeLinks,
                    products: productsByCategory.get(r.id) ?? 0, // ← associated product count (direct)
                },
                children: [],
            });
        }

        const roots: TreeNode[] = [];
        for (const r of rows) {
            const node = byId.get(r.id)!;
            if (r.parentId && byId.has(r.parentId)) byId.get(r.parentId)!.children.push(node);
            else roots.push(node);
        }

        return roots;
    }


    async update(id: string, dto: UpdateCategoryDto) {
        const before = await this.prisma.category.findUnique({
            where: { id },
            select: { id: true, parentId: true },
        });
        if (!before) throw new NotFoundException('Category not found');

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.category.update({ where: { id }, data: dto });

            const parentChanged =
                dto.parentId !== undefined && dto.parentId !== before.parentId;

            if (parentChanged) {
                await this.pathSvc.rebuildSubtreePaths(
                    tx,
                    updated.id,
                    updated.parentId ?? null,
                );
            }

            return updated;
        });
    }

    async remove(id: string) {
        await this.prisma.category.delete({ where: { id } });
        return { ok: true };
    }
}
