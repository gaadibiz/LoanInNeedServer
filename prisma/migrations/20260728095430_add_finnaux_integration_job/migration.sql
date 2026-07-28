-- CreateTable
CREATE TABLE "FinnauxIntegrationJob" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "finnauxApplicationId" TEXT,
    "finnauxReferenceId" TEXT,
    "rawRequest" JSONB,
    "rawResponse" JSONB,
    "lastError" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinnauxIntegrationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinnauxIntegrationJob_applicationId_key" ON "FinnauxIntegrationJob"("applicationId");

-- CreateIndex
CREATE INDEX "FinnauxIntegrationJob_userId_idx" ON "FinnauxIntegrationJob"("userId");

-- AddForeignKey
ALTER TABLE "FinnauxIntegrationJob" ADD CONSTRAINT "FinnauxIntegrationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinnauxIntegrationJob" ADD CONSTRAINT "FinnauxIntegrationJob_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

