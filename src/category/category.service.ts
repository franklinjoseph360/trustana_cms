import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryTreePathService } from '../category-tree-path/category-tree-path.service';


@Injectable()
export class CategoryService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly pathSvc: CategoryTreePathService,
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
