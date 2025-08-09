import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { CategoryTreePathModule } from 'src/category-tree-path/category-tree-path.module';

@Module({
  imports: [CategoryTreePathModule],
  providers: [CategoryService],
  controllers: [CategoryController],
})
export class CategoryModule {}
