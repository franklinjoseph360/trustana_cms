import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, IsArray, ArrayUnique } from 'class-validator';
import { AttributeType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAttributeDto {
  @ApiProperty({ example: 'Sugar Content', description: 'Public display name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'sugar-content', description: 'URL-safe slug; auto-generated from name if omitted' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ enum: AttributeType, example: AttributeType.NUMBER, default: AttributeType.TEXT })
  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType = AttributeType.TEXT;

  @ApiPropertyOptional({ example: false, default: false, description: 'If true, applies to all products (no direct links)' })
  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean = false;

  @ApiPropertyOptional({
    type: [String],
    description: 'Categories to directly link on creation (ignored when isGlobal=true)',
    example: [
      '92ca8f79-b117-4cdb-9d07-2312a8ae2939',
      '2889f048-2669-46cd-af01-13b2b3d24823'
    ]
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  categoryIds?: string[] = [];
}
