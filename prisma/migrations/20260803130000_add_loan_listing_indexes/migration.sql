-- CreateIndex
CREATE INDEX "FinnauxIntegrationJob_createdAt_idx" ON "FinnauxIntegrationJob"("createdAt");

-- CreateIndex
CREATE INDEX "LoanApplication_status_createdAt_idx" ON "LoanApplication"("status", "createdAt");
