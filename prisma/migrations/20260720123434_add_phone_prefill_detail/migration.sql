-- CreateTable
CREATE TABLE "PhonePrefillDetail" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "pan" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "response" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhonePrefillDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhonePrefillDetail_userId_key" ON "PhonePrefillDetail"("userId");

-- AddForeignKey
ALTER TABLE "PhonePrefillDetail" ADD CONSTRAINT "PhonePrefillDetail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
