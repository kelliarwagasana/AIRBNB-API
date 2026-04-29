-- DropForeignKey
ALTER TABLE "Listing" DROP CONSTRAINT "Listing_hostId_fkey";

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
