-- CreateTable
CREATE TABLE "public"."Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isLeaf" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CategoryTreePath" (
    "parentCategoryId" TEXT NOT NULL,
    "childCategoryId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "CategoryTreePath_pkey" PRIMARY KEY ("parentCategoryId","childCategoryId")
);

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "public"."Category"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_parentId_key" ON "public"."Category"("name", "parentId");

-- CreateIndex
CREATE INDEX "CategoryTreePath_childCategoryId_idx" ON "public"."CategoryTreePath"("childCategoryId");

-- CreateIndex
CREATE INDEX "CategoryTreePath_parentCategoryId_idx" ON "public"."CategoryTreePath"("parentCategoryId");

-- AddForeignKey
ALTER TABLE "public"."Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CategoryTreePath" ADD CONSTRAINT "CategoryTreePath_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CategoryTreePath" ADD CONSTRAINT "CategoryTreePath_childCategoryId_fkey" FOREIGN KEY ("childCategoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
