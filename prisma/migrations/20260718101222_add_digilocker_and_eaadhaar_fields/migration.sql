-- CreateEnum
CREATE TYPE "DigilockerStatus" AS ENUM ('URL_CREATED', 'CONSENT_COMPLETED', 'CONSENT_FAILED', 'FETCH_FAILED');

-- AlterTable
ALTER TABLE "AadhaarVerification" ADD COLUMN     "aadhaarJpegUrl" TEXT,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "dob" TEXT,
ADD COLUMN     "eAadhaarFetchedAt" TIMESTAMP(3),
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "rawResponse" JSONB,
ADD COLUMN     "splitAddress" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "digilockerRequestId" TEXT,
ADD COLUMN     "digilockerStatus" "DigilockerStatus";

-- CreateIndex
CREATE UNIQUE INDEX "User_digilockerRequestId_key" ON "User"("digilockerRequestId");

