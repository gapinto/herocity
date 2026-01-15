-- Add friendlyId column as nullable
ALTER TABLE "menu_items" ADD COLUMN "friendlyId" INTEGER;

-- Backfill per restaurant using creation order
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "restaurantId" ORDER BY "createdAt", id) AS rn
  FROM "menu_items"
)
UPDATE "menu_items"
SET "friendlyId" = ranked.rn
FROM ranked
WHERE "menu_items".id = ranked.id;

-- Enforce not null and uniqueness per restaurant
ALTER TABLE "menu_items" ALTER COLUMN "friendlyId" SET NOT NULL;
CREATE UNIQUE INDEX "menu_items_restaurantId_friendlyId_key"
  ON "menu_items"("restaurantId", "friendlyId");
