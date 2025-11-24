-- CreateEnum
CREATE TYPE "public"."DocumentUploadStatus" AS ENUM ('PENDING_UPLOAD', 'SUBMITTED', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."UserDocumentStatus" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_UPLOAD',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDocumentStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserDocumentStatus_userId_key" ON "public"."UserDocumentStatus"("userId");

-- AddForeignKey
ALTER TABLE "public"."UserDocumentStatus" ADD CONSTRAINT "UserDocumentStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
