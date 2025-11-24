/*
  Warnings:

  - You are about to drop the column `address` on the `AddressDetail` table. All the data in the column will be lost.
  - You are about to drop the column `addressType` on the `AddressDetail` table. All the data in the column will be lost.
  - You are about to drop the column `employerName` on the `EmploymentDetail` table. All the data in the column will be lost.
  - You are about to drop the column `amount` on the `Loan` table. All the data in the column will be lost.
  - Added the required column `loanAmount` to the `Loan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."AddressDetail" DROP COLUMN "address",
DROP COLUMN "addressType",
ADD COLUMN     "currentAddress" TEXT,
ADD COLUMN     "currentAddressProof" TEXT,
ADD COLUMN     "currentAddressType" "public"."AddressType",
ADD COLUMN     "permanentAddress" TEXT;

-- AlterTable
ALTER TABLE "public"."EmploymentDetail" DROP COLUMN "employerName",
ADD COLUMN     "companyAddress" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "monthlyIncome" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."Loan" DROP COLUMN "amount",
ADD COLUMN     "loanAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "purposeOfLoan" TEXT,
ALTER COLUMN "interestRate" DROP NOT NULL,
ALTER COLUMN "termMonths" DROP NOT NULL,
ALTER COLUMN "startDate" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';
