/*
  Warnings:

  - You are about to drop the column `annualIncome` on the `EmploymentDetail` table. All the data in the column will be lost.
  - You are about to drop the column `companyName` on the `EmploymentDetail` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `EmploymentDetail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `employmentType` to the `EmploymentDetail` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."EmploymentType" AS ENUM ('SALARIED', 'SELF_EMPLOYED', 'STUDENT', 'UNEMPLOYED', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."LoanType" AS ENUM ('PERSONAL', 'HOME', 'EDUCATION', 'BUSINESS', 'AUTO', 'CREDIT_CARD', 'OTHER');

-- AlterTable
ALTER TABLE "public"."EmploymentDetail" DROP COLUMN "annualIncome",
DROP COLUMN "companyName",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "employerName" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "employmentType",
ADD COLUMN     "employmentType" "public"."EmploymentType" NOT NULL;

-- CreateTable
CREATE TABLE "public"."LoanApplication" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "employmentDetailId" INTEGER,
    "loanType" "public"."LoanType" NOT NULL,
    "loanAmount" DOUBLE PRECISION,
    "otpVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."LoanStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanApplication_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."LoanApplication" ADD CONSTRAINT "LoanApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LoanApplication" ADD CONSTRAINT "LoanApplication_employmentDetailId_fkey" FOREIGN KEY ("employmentDetailId") REFERENCES "public"."EmploymentDetail"("id") ON DELETE SET NULL ON UPDATE CASCADE;
