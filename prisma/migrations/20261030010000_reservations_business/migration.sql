-- Additive; existing order/payment snapshots are untouched.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';
ALTER TABLE "Restaurant" ADD COLUMN "businessSettings" JSONB,
  ADD COLUMN "businessVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Table" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN "email" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "endsAt" TIMESTAMP(3),
  ADD COLUMN "trackingTokenHash" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "requestHash" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Legacy model-only bookings retain their data and receive a bounded hold.
UPDATE "Reservation" SET "endsAt" = "startsAt" + INTERVAL '90 minutes';
ALTER TABLE "Reservation" ALTER COLUMN "endsAt" SET NOT NULL;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_valid_window" CHECK ("endsAt" > "startsAt"),
  ADD CONSTRAINT "Reservation_valid_party" CHECK ("partySize" > 0);
CREATE UNIQUE INDEX "Reservation_idempotencyKey_key" ON "Reservation"("idempotencyKey");
CREATE INDEX "Reservation_restaurantId_startsAt_idx" ON "Reservation"("restaurantId", "startsAt");
-- Half-open ranges allow adjacent reservations. The database also rejects
-- overlaps from direct SQL, not just requests through this application's locks.
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_no_table_overlap"
  EXCLUDE USING gist ("tableId" WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE ("status" IN ('REQUESTED', 'CONFIRMED', 'SEATED'));
ALTER TABLE "Order" ADD COLUMN "reservationId" TEXT, ADD COLUMN "deliveryZone" TEXT;
CREATE UNIQUE INDEX "Order_reservationId_key" ON "Order"("reservationId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
