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
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('Products')
@Controller('products')
export class ProductController {
  constructor(@Inject(ProductService) private readonly svc: ProductService) {}

  @Post()
  @ApiOperation({ summary: 'Create a product' })
  @ApiCreatedResponse({ description: 'Product created successfully' })
  @ApiBody({
    type: CreateProductDto,
    examples: {
      basic: {
        summary: 'Minimal payload',
        value: {
          name: 'Espresso',
          categoryId: 'c3a5d3c2-0c0a-4e7a-9a6f-1b1c9c7b0f10',
        },
      },
      withAttributes: {
        summary: 'With attribute values',
        value: {
          name: 'Espresso',
          categoryId: 'c3a5d3c2-0c0a-4e7a-9a6f-1b1c9c7b0f10',
          attributeValues: [
            { attributeId: 'a1111111-2222-3333-4444-555555555555', value: '250' },
            { attributeId: 'b1111111-2222-3333-4444-555555555555', value: 'Arabica' },
          ],
        },
      },
    },
  })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  create(@Body() dto: CreateProductDto) {
    return this.svc.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List products' })
  @ApiOkResponse({ description: 'List of products' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 25 })
  @ApiQuery({ name: 'q', required: false, description: 'Search by keyword' })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filter by category UUID',
    example: 'c3a5d3c2-0c0a-4e7a-9a6f-1b1c9c7b0f10',
  })
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.svc.findAll({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 25,
      q,
      categoryId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by id' })
  @ApiOkResponse({ description: 'Product found' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiOkResponse({ description: 'Product updated successfully' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiBody({
    type: UpdateProductDto,
    examples: {
      rename: {
        summary: 'Change name',
        value: { name: 'Espresso Double Shot' },
      },
      moveCategory: {
        summary: 'Move to another category',
        value: { categoryId: '11111111-2222-3333-4444-555555555555' },
      },
      attributes: {
        summary: 'Replace attribute values',
        value: {
          attributeValues: [
            { attributeId: 'a1111111-2222-3333-4444-555555555555', value: '300' },
            { attributeId: 'b1111111-2222-3333-4444-555555555555', value: 'Robusta' },
          ],
        },
      },
    },
  })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateProductDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiNoContentResponse({ description: 'Product deleted' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.remove(id);
  }
}
