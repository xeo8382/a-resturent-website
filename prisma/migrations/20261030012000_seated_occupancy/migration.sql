-- A seated party remains physically occupied until staff completes it, even
-- after its scheduled hold ends. Never seat two parties on the same table.
CREATE UNIQUE INDEX "Reservation_one_seated_party_per_table"
  ON "Reservation"("tableId") WHERE "status" = 'SEATED';
