-- AlterTable
ALTER TABLE "public"."UserDocument" ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "size" INTEGER,
ADD COLUMN     "status" "public"."DocumentUploadStatus" NOT NULL DEFAULT 'SUBMITTED',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" INTEGER;

-- CreateIndex
CREATE INDEX "UserDocument_userId_docType_idx" ON "public"."UserDocument"("userId", "docType");
