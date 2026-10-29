-- Additive provenance. Existing customer orders remain ONLINE.
CREATE TYPE "OrderSource" AS ENUM ('ONLINE', 'STAFF');
ALTER TABLE "Order" ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "Order" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- A table remains occupied until its check is completed or cancelled.
-- This also protects against writers outside the staff creation endpoint.
CREATE UNIQUE INDEX "Order_one_active_per_table" ON "Order" ("tableId")
WHERE "tableId" IS NOT NULL AND "status" NOT IN ('COMPLETED', 'CANCELLED');
