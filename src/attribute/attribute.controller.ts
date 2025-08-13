import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AttributeService } from './attribute.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';

type LinkType = 'direct' | 'inherited' | 'global' | 'not-applicable';
const LINK_TYPES: ReadonlySet<string> = new Set(['direct', 'inherited', 'global', 'not-applicable']);
const SORTS = new Set(['name', 'createdAt', 'updatedAt'] as const);

function parseList(input?: string | string[]): string[] {
  if (!input) return [];
  const parts = Array.isArray(input) ? input : String(input).split(',');
  return parts
    .flatMap(p => String(p).split(','))
    .map(s => s.trim())
    .filter(Boolean);
}

function coerceLinkTypes(input?: string | string[]): LinkType[] {
  const seen = new Set<string>();
  for (const v of parseList(input)) {
    const k = v.toLowerCase();
    if (LINK_TYPES.has(k)) seen.add(k);
  }
  return Array.from(seen) as LinkType[];
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

@ApiTags('Attributes')
@Controller('attributes')
export class AttributeController {
  constructor(@Inject(AttributeService) private readonly svc: AttributeService) {}

  @Post()
  @ApiOperation({ summary: 'Create an attribute (optionally linking to multiple categories)' })
  @ApiBody({
    type: CreateAttributeDto,
    examples: {
      directToMany: {
        summary: 'Direct links to multiple categories',
        value: {
          name: 'Sugar Content',
          type: 'NUMBER',
          categoryIds: [
            '92ca8f79-b117-4cdb-9d07-2312a8ae2939',
            '2889f048-2669-46cd-af01-13b2b3d24823',
          ],
        },
      },
      global: {
        summary: 'Global attribute (no direct links)',
        value: {
          name: 'Country of Origin',
          slug: 'country-of-origin',
          isGlobal: true,
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Attribute created',
    schema: {
      properties: {
        attribute: {
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            slug: { type: 'string' },
            type: { type: 'string', enum: ['TEXT', 'NUMBER', 'BOOLEAN', 'JSON'] },
            isGlobal: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'name', 'slug', 'type', 'isGlobal', 'createdAt', 'updatedAt'],
          type: 'object',
        },
        linksCreated: { type: 'integer', example: 2 },
      },
      required: ['attribute', 'linksCreated'],
      type: 'object',
    },
  })
  @ApiBadRequestResponse({ description: 'Validation error (unknown categoryIds, non-leaf categories, etc.)' })
  @ApiConflictResponse({ description: 'Attribute with the same name or slug already exists' })
  create(@Body() dto: CreateAttributeDto) {
    return this.svc.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List attributes',
    description:
      'When categoryIds is provided, returns attributes applicable to those categories. Refine with linkType: direct, inherited, global, or not-applicable.',
  })
  @ApiOkResponse({ description: 'Paginated list of attributes' })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search by name or slug (case insensitive substring)',
    example: 'country',
    type: String,
  })
  @ApiQuery({
    name: 'categoryIds',
    required: false,
    description: 'CSV "a,b,c" or repeated ?categoryIds=a&categoryIds=b',
    type: [String],
    style: 'form',
    explode: false,
    example: ['92ca8f79-b117-4cdb-9d07-2312a8ae2939', '2889f048-2669-46cd-af01-13b2b3d24823'],
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
    @Query('q') q?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '50',
    @Query('sort') sort: 'name' | 'createdAt' | 'updatedAt' = 'name',
  ) {
    const ids = parseList(categoryIds);
    const linkTypes = coerceLinkTypes(linkType);
    const pageNum = Number.isFinite(Number(page)) ? Number(page) : 1;
    const pageSizeNum = Number.isFinite(Number(pageSize)) ? Number(pageSize) : 50;
    const sortSafe = SORTS.has(sort) ? sort : 'name';

    return this.svc.findAttributes({
      categoryIds: ids.length ? ids : undefined,
      linkTypes: linkTypes.length ? linkTypes : undefined,
      q: q?.trim() || undefined,
      page: clamp(pageNum, 1, 10_000),
      pageSize: clamp(pageSizeNum, 1, 200),
      sort: sortSafe,
    });
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateAttributeDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.svc.remove(id);
  }
}
