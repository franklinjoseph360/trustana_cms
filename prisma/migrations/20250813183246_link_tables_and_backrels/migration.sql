/*
  Warnings:

  - You are about to drop the column `isGlobal` on the `Attribute` table. All the data in the column will be lost.
  - The primary key for the `ProductAttributeValue` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `valueBoolean` on the `ProductAttributeValue` table. All the data in the column will be lost.
  - You are about to drop the column `valueJson` on the `ProductAttributeValue` table. All the data in the column will be lost.
  - You are about to drop the column `valueNumber` on the `ProductAttributeValue` table. All the data in the column will be lost.
  - You are about to drop the column `valueString` on the `ProductAttributeValue` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[productId,attributeId]` on the table `ProductAttributeValue` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `ProductAttributeValue` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `updatedAt` to the `ProductAttributeValue` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."ProductAttributeValue" DROP CONSTRAINT "ProductAttributeValue_attributeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductAttributeValue" DROP CONSTRAINT "ProductAttributeValue_productId_fkey";

-- DropIndex
DROP INDEX "public"."Attribute_isGlobal_idx";

-- DropIndex
DROP INDEX "public"."Attribute_name_key";

-- DropIndex
DROP INDEX "public"."Product_categoryId_idx";

-- AlterTable
ALTER TABLE "public"."Attribute" DROP COLUMN "isGlobal",
ALTER COLUMN "type" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."ProductAttributeValue" DROP CONSTRAINT "ProductAttributeValue_pkey",
DROP COLUMN "valueBoolean",
DROP COLUMN "valueJson",
DROP COLUMN "valueNumber",
DROP COLUMN "valueString",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "public"."CategoryProductLink" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryProductLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductAttributeLink" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAttributeLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryProductLink_categoryId_idx" ON "public"."CategoryProductLink"("categoryId");

-- CreateIndex
CREATE INDEX "CategoryProductLink_productId_idx" ON "public"."CategoryProductLink"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryProductLink_categoryId_productId_key" ON "public"."CategoryProductLink"("categoryId", "productId");

-- CreateIndex
CREATE INDEX "ProductAttributeLink_attributeId_idx" ON "public"."ProductAttributeLink"("attributeId");

-- CreateIndex
CREATE INDEX "ProductAttributeLink_productId_idx" ON "public"."ProductAttributeLink"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttributeLink_productId_attributeId_key" ON "public"."ProductAttributeLink"("productId", "attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttributeValue_productId_attributeId_key" ON "public"."ProductAttributeValue"("productId", "attributeId");

-- AddForeignKey
ALTER TABLE "public"."CategoryProductLink" ADD CONSTRAINT "CategoryProductLink_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CategoryProductLink" ADD CONSTRAINT "CategoryProductLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductAttributeLink" ADD CONSTRAINT "ProductAttributeLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductAttributeLink" ADD CONSTRAINT "ProductAttributeLink_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "public"."Attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "public"."Attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
