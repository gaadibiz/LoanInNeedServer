-- AlterTable
ALTER TABLE "FinnauxIntegrationJob"
  ALTER COLUMN "aadharDocumentId" TYPE INTEGER USING "aadharDocumentId"::INTEGER,
  ALTER COLUMN "panDocumentId" TYPE INTEGER USING "panDocumentId"::INTEGER,
  ALTER COLUMN "salarySlipDocumentId" TYPE INTEGER USING "salarySlipDocumentId"::INTEGER,
  ALTER COLUMN "bankStatementDocumentId" TYPE INTEGER USING "bankStatementDocumentId"::INTEGER;
