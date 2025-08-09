import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CategoryTreePathService {
  /** Insert depth-0 self row for a category */
  async addSelfRow(tx: Tx, categoryId: string) {
    await tx.categoryTreePath.create({
      data: { parentCategoryId: categoryId, childCategoryId: categoryId, depth: 0 },
    });
  }

  /** Link all ancestors of parent -> new child (depth = ancestor.depth + 1) */
  async linkAncestorsOfParentToChild(tx: Tx, parentId: string, childId: string) {
    const ancestors = await tx.categoryTreePath.findMany({
      where: { childCategoryId: parentId },
      select: { parentCategoryId: true, depth: true },
    });

    if (ancestors.length === 0) return;

    await tx.categoryTreePath.createMany({
      data: ancestors.map(a => ({
        parentCategoryId: a.parentCategoryId,
        childCategoryId: childId,
        depth: a.depth + 1,
      })),
      skipDuplicates: true,
    });
  }

  /** Convenience after create */
  async addPathsForNewCategory(tx: Tx, category: { id: string; parentId: string | null }) {
    await this.addSelfRow(tx, category.id);
    if (category.parentId) {
      await this.linkAncestorsOfParentToChild(tx, category.parentId, category.id);
    }
  }

  /**
   * Rebuild closure paths for a single category after changing its parent.
   * NOTE: This handles the node only (not descendants). Extend later if you need full-subtree updates.
   */
  async rebuildSubtreePaths(tx: Tx, categoryId: string, newParentId: string | null) {
    // 1) Ensure self row exists
    await tx.categoryTreePath.upsert({
      where: { parentCategoryId_childCategoryId: { parentCategoryId: categoryId, childCategoryId: categoryId } },
      create: { parentCategoryId: categoryId, childCategoryId: categoryId, depth: 0 },
      update: {},
    });

    // 2) Remove all non-self ancestor links for this child
    await tx.categoryTreePath.deleteMany({
      where: {
        childCategoryId: categoryId,
        NOT: { parentCategoryId: categoryId },
      },
    });

    // 3) If detached (no parent), nothing else to add
    if (!newParentId) return;

    // 4) Add new ancestors (including new parent’s ancestors) -> child
    await this.linkAncestorsOfParentToChild(tx, newParentId, categoryId);
  }
}
