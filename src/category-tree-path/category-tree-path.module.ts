import { Module } from '@nestjs/common';
import { CategoryTreePathService } from './category-tree-path.service';

@Module({
  providers: [CategoryTreePathService],
  exports: [CategoryTreePathService],
})
export class CategoryTreePathModule {}