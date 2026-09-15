-- CreateTable
CREATE TABLE "IpQualityDetail" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "fraudScore" TEXT,
    "botStatus" TEXT,
    "isCrawler" TEXT,
    "proxy" TEXT,
    "vpn" TEXT,
    "tor" TEXT,
    "recentAbuse" TEXT,
    "mobile" TEXT,
    "city" TEXT,
    "region" TEXT,
    "countryCode" TEXT,
    "isp" TEXT,
    "asn" TEXT,
    "organization" TEXT,
    "timezone" TEXT,
    "latitude" TEXT,
    "longitude" TEXT,
    "host" TEXT,
    "address" TEXT,
    "response" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IpQualityDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IpQualityDetail_userId_key" ON "IpQualityDetail"("userId");

-- AddForeignKey
ALTER TABLE "IpQualityDetail" ADD CONSTRAINT "IpQualityDetail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
