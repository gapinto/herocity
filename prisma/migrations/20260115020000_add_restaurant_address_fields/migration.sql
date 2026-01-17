-- Add address fields to restaurants
ALTER TABLE "restaurants" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "restaurants" ADD COLUMN "addressNumber" TEXT;
ALTER TABLE "restaurants" ADD COLUMN "complement" TEXT;
ALTER TABLE "restaurants" ADD COLUMN "province" TEXT;
ALTER TABLE "restaurants" ADD COLUMN "city" TEXT;
ALTER TABLE "restaurants" ADD COLUMN "state" TEXT;

-- Backfill existing rows with empty strings
UPDATE "restaurants"
SET
  address = COALESCE(address, ''),
  "postalCode" = COALESCE("postalCode", ''),
  "addressNumber" = COALESCE("addressNumber", ''),
  "complement" = COALESCE("complement", ''),
  "province" = COALESCE("province", ''),
  "city" = COALESCE("city", ''),
  "state" = COALESCE("state", '');

-- Enforce required fields
ALTER TABLE "restaurants" ALTER COLUMN "address" SET NOT NULL;
ALTER TABLE "restaurants" ALTER COLUMN "postalCode" SET NOT NULL;
ALTER TABLE "restaurants" ALTER COLUMN "addressNumber" SET NOT NULL;
ALTER TABLE "restaurants" ALTER COLUMN "complement" SET NOT NULL;
ALTER TABLE "restaurants" ALTER COLUMN "province" SET NOT NULL;
ALTER TABLE "restaurants" ALTER COLUMN "city" SET NOT NULL;
ALTER TABLE "restaurants" ALTER COLUMN "state" SET NOT NULL;
