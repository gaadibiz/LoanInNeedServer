/*
  Warnings:

  - The values [OWNER,RESIDENTIAL] on the enum `AddressType` will be removed. If these variants are still used in the database, this will fail.
  - The values [PERSONAL,HOME,AUTO,CREDIT_CARD] on the enum `LoanType` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."PartnerType" AS ENUM ('DSA', 'BC', 'AFFILIATE', 'API_PARTNER');

-- CreateEnum
CREATE TYPE "public"."PartnerStatusType" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."ProfileType" AS ENUM ('INDIVIDUAL', 'FIRM');

-- CreateEnum
CREATE TYPE "public"."AttributionType" AS ENUM ('ONLINE_LINK', 'ASSISTED', 'ORGANIC', 'ADMIN_OVERRIDE');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."AddressType_new" AS ENUM ('OWNER_SELF_OR_FAMILY', 'RENTED');
ALTER TABLE "public"."AddressDetail" ALTER COLUMN "currentAddressType" TYPE "public"."AddressType_new" USING ("currentAddressType"::text::"public"."AddressType_new");
ALTER TYPE "public"."AddressType" RENAME TO "AddressType_old";
ALTER TYPE "public"."AddressType_new" RENAME TO "AddressType";
DROP TYPE "public"."AddressType_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."DocumentType" ADD VALUE 'GST_CERTIFICATE';
ALTER TYPE "public"."DocumentType" ADD VALUE 'TRADE_LICENSE';
ALTER TYPE "public"."DocumentType" ADD VALUE 'COMPANY_PAN';

-- AlterEnum
BEGIN;
CREATE TYPE "public"."LoanType_new" AS ENUM ('MEDICAL_EMERGENCY', 'EDUCATION', 'HOME_RENOVATION', 'DEBT_CONSOLIDATION', 'WEDDING', 'BUSINESS', 'TRAVEL', 'OTHER');
ALTER TABLE "public"."LoanApplication" ALTER COLUMN "loanType" TYPE "public"."LoanType_new" USING ("loanType"::text::"public"."LoanType_new");
ALTER TYPE "public"."LoanType" RENAME TO "LoanType_old";
ALTER TYPE "public"."LoanType_new" RENAME TO "LoanType";
DROP TYPE "public"."LoanType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "public"."UserRole" ADD VALUE 'BC';

-- AlterTable
ALTER TABLE "public"."LoanApplication" ADD COLUMN     "attributedPartnerId" INTEGER,
ADD COLUMN     "attributionSource" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "attributedPartnerId" INTEGER,
ADD COLUMN     "attributionDate" TIMESTAMP(3),
ADD COLUMN     "attributionType" "public"."AttributionType",
ADD COLUMN     "profileType" "public"."ProfileType";

-- CreateTable
CREATE TABLE "public"."BusinessDetail" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "firmName" TEXT NOT NULL,
    "gstNumber" TEXT,
    "tradeLicense" TEXT,
    "companyPan" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PartnerStatus" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "approvedBy" INTEGER,
    "secretKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Partner" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "partnerType" "public"."PartnerType" NOT NULL,
    "status" "public"."PartnerStatusType" NOT NULL DEFAULT 'PENDING',
    "gstNumber" TEXT,
    "panNumber" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "secretKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttributionLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "partnerId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDetail_userId_key" ON "public"."BusinessDetail"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerStatus_userId_key" ON "public"."PartnerStatus"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_email_key" ON "public"."Partner"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_phone_key" ON "public"."Partner"("phone");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_attributedPartnerId_fkey" FOREIGN KEY ("attributedPartnerId") REFERENCES "public"."Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BusinessDetail" ADD CONSTRAINT "BusinessDetail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PartnerStatus" ADD CONSTRAINT "PartnerStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttributionLog" ADD CONSTRAINT "AttributionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttributionLog" ADD CONSTRAINT "AttributionLog_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
