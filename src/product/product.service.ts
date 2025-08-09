import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertLeafCategory(categoryId: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, isLeaf: true },
    });
    if (!cat) throw new BadRequestException('Category does not exist');
    if (!cat.isLeaf) throw new BadRequestException('Product must be linked to a leaf category');
  }

  async create(dto: CreateProductDto) {
    await this.assertLeafCategory(dto.categoryId);
    return this.prisma.product.create({ data: dto });
  }

  findAll() {
    return this.prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: { category: true },
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
    const exists = await this.prisma.product.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Product not found');

    if (dto.categoryId) {
      await this.assertLeafCategory(dto.categoryId);
    }
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }
}
