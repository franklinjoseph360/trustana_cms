import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';

@Injectable()
export class AttributeService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateAttributeDto) {
    return this.prisma.attribute.create({ data: dto });
  }

  findAll() {
    return this.prisma.attribute.findMany({ orderBy: { name: 'asc' } });
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
}
