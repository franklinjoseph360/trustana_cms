import { IsString, IsUUID } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsUUID()
  categoryId: string;
}
