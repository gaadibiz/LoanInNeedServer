-- CreateIndex
CREATE INDEX "FinnauxIntegrationJob_status_retryCount_updatedAt_idx" ON "FinnauxIntegrationJob"("status", "retryCount", "updatedAt");
