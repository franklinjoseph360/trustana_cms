// src/product/dto/create-product.dto.ts
import {
  IsString,
  IsUUID,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

class ProductAttributeValueInput {
  @IsOptional() @IsUUID() attributeId?: string;    // allow id…
  @IsOptional() @IsString() attributeSlug?: string; // …or slug

  @IsOptional() @IsString()
  value?: string; // adapt to your value types
}

export class CreateProductDto {
  @IsString()
  name: string;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeValueInput)
  attributeValues?: ProductAttributeValueInput[];
}
