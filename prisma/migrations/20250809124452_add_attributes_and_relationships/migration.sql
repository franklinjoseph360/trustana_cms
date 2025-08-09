/*
  Warnings:

  - A unique constraint covering the columns `[slug,parentId]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Category` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."AttributeType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'JSON');

-- DropForeignKey
ALTER TABLE "public"."CategoryTreePath" DROP CONSTRAINT "CategoryTreePath_childCategoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CategoryTreePath" DROP CONSTRAINT "CategoryTreePath_parentCategoryId_fkey";

-- AlterTable
ALTER TABLE "public"."Category" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "public"."Attribute" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "type" "public"."AttributeType" NOT NULL DEFAULT 'TEXT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CategoryAttributeLink" (
    "categoryId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,

    CONSTRAINT "CategoryAttributeLink_pkey" PRIMARY KEY ("categoryId","attributeId")
);

-- CreateTable
CREATE TABLE "public"."ProductAttributeValue" (
    "productId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "valueString" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueBoolean" BOOLEAN,
    "valueJson" JSONB,

    CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("productId","attributeId")
);

-- CreateIndex
CREATE INDEX "Attribute_isGlobal_idx" ON "public"."Attribute"("isGlobal");

-- CreateIndex
CREATE UNIQUE INDEX "Attribute_name_key" ON "public"."Attribute"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Attribute_slug_key" ON "public"."Attribute"("slug");

-- CreateIndex
CREATE INDEX "CategoryAttributeLink_attributeId_idx" ON "public"."CategoryAttributeLink"("attributeId");

-- CreateIndex
CREATE INDEX "CategoryAttributeLink_categoryId_idx" ON "public"."CategoryAttributeLink"("categoryId");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_attributeId_idx" ON "public"."ProductAttributeValue"("attributeId");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_productId_idx" ON "public"."ProductAttributeValue"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_parentId_key" ON "public"."Category"("slug", "parentId");

-- AddForeignKey
ALTER TABLE "public"."CategoryTreePath" ADD CONSTRAINT "CategoryTreePath_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CategoryTreePath" ADD CONSTRAINT "CategoryTreePath_childCategoryId_fkey" FOREIGN KEY ("childCategoryId") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CategoryAttributeLink" ADD CONSTRAINT "CategoryAttributeLink_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CategoryAttributeLink" ADD CONSTRAINT "CategoryAttributeLink_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "public"."Attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "public"."Attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
