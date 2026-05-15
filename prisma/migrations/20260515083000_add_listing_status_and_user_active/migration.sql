-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('PENDING_APPROVAL', 'PUBLISHED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN "status" "ListingStatus" NOT NULL DEFAULT 'PUBLISHED';

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");
