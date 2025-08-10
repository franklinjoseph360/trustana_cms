import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { AttributeService } from './attribute.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Attributes')
@Controller('attributes')
export class AttributeController {
  constructor(@Inject(AttributeService) private readonly svc: AttributeService) { }

  @Post()
  create(@Body() dto: CreateAttributeDto) {
    return this.svc.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List attributes',
    description:
      'When categoryIds is provided, returns attributes that are applicable to those categories. You may refine by linkType: direct, inherited, global, or select not-applicable to invert.',
  })
  @ApiOkResponse({
    description: 'Paginated list of attributes',
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  @ApiQuery({
    name: 'categoryIds',
    required: false,
    description: 'CSV "a,b,c" or repeated ?categoryIds=a&categoryIds=b',
    type: [String],
    style: 'form',
    explode: false,
    example: ['coffee', 'tea'],
  })
  @ApiQuery({
    name: 'linkType',
    required: false,
    description: 'CSV or repeated. Accepts direct, inherited, global, not-applicable',
    enum: ['direct', 'inherited', 'global', 'not-applicable'],
    isArray: true,
    style: 'form',
    explode: false,
    example: ['direct', 'inherited'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 50 })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['name', 'createdAt', 'updatedAt'],
    example: 'name',
  })
  find(
    @Query('categoryIds') categoryIds?: string | string[],
    @Query('linkType') linkType?: string | string[],
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
      page: Number(page) || 1,
      pageSize: Math.min(Math.max(Number(pageSize) || 50, 1), 200),
      sort,
    });
  }

  @Get(':id') findOne(@Param('id') id: string) { return this.svc.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateAttributeDto) { return this.svc.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(id); }
}
