-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."LoanStatus" ADD VALUE 'HOLD';
ALTER TYPE "public"."LoanStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "public"."LoanStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "public"."LoanApplication" ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "employeeName" TEXT,
ADD COLUMN     "loanAccountNumber" TEXT,
ADD COLUMN     "losApplicationNumber" TEXT,
ADD COLUMN     "reason" TEXT;

-- CreateTable
CREATE TABLE "public"."LosIntegrationJob" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "losApplicationId" TEXT,
    "losCaseNumber" TEXT,
    "losKycId" TEXT,
    "rawRequest" JSONB,
    "rawResponse" JSONB,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LosIntegrationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LosIntegrationJob_applicationId_key" ON "public"."LosIntegrationJob"("applicationId");

-- AddForeignKey
ALTER TABLE "public"."LosIntegrationJob" ADD CONSTRAINT "LosIntegrationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LosIntegrationJob" ADD CONSTRAINT "LosIntegrationJob_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "public"."LoanApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
