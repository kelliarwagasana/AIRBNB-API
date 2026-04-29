/*
  Warnings:

  - Added the required column `password` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "User"
ADD COLUMN     "password" TEXT,
ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "User"
SET
  "password" = '$2b$10$kPXDLU0jIoRiGzYa74Efi.GJqrbln98wk667l0pQgVLN7Oh/GASy.',
  "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "password" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "password" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;
