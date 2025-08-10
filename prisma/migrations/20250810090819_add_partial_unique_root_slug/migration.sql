-- Enforce uniqueness of slug for root categories (parentId IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS category_root_slug_unique
ON "Category" ("slug")
WHERE "parentId" IS NULL;
