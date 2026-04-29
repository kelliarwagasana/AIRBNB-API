-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "guests" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Listing_location_idx" ON "Listing"("location");

-- CreateIndex
CREATE INDEX "Listing_type_idx" ON "Listing"("type");

-- CreateIndex
CREATE INDEX "Listing_pricePerNight_idx" ON "Listing"("pricePerNight");
