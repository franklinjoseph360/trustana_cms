// src/attribute/attribute.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AttributeService } from './attribute.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';

@Controller('attributes')
export class AttributeController {
  constructor(private readonly svc: AttributeService) {}

  @Post()
  create(@Body() dto: CreateAttributeDto) {
    return this.svc.create(dto);
  }

  @Get()
  find(
    @Query('categoryIds') categoryIds?: string | string[],
    @Query('linkType') linkType?: string | string[],   // CSV or repeated
    @Query('q') q?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '50',
    @Query('sort') sort: 'name' | 'createdAt' | 'updatedAt' = 'name',
  ) {
    const ids = Array.isArray(categoryIds)
      ? categoryIds.flatMap(v => v.split(',').map(s => s.trim()).filter(Boolean))
      : (categoryIds ?? '').split(',').map(s => s.trim()).filter(Boolean);

    const linkTypes = Array.isArray(linkType)
      ? linkType.flatMap(v => v.split(',').map(s => s.trim()).filter(Boolean))
      : (linkType ?? '').split(',').map(s => s.trim()).filter(Boolean);

    return this.svc.findAttributes({
      categoryIds: ids.length ? ids : undefined,
      linkTypes: linkTypes.length ? (linkTypes as any) : undefined,
      q,
      page: Number(page) || 1,
      pageSize: Math.min(Math.max(Number(pageSize) || 50, 1), 200),
      sort,
    });
  }

  @Get(':id') findOne(@Param('id') id: string) { return this.svc.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateAttributeDto) { return this.svc.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(id); }
}
