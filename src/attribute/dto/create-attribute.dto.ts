import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { AttributeType } from '@prisma/client';

export class CreateAttributeDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType = AttributeType.TEXT;

  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean = false;
}
