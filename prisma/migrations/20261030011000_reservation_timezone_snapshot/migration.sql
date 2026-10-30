-- Keep the timezone promised at booking even if operating configuration changes.
ALTER TABLE "Reservation" ADD COLUMN "timeZone" TEXT;
