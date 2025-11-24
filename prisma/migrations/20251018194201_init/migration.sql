-- CreateEnum
CREATE TYPE "public"."VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('CUSTOMER', 'DSA', 'AFFILIATE', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "public"."JobStability" AS ENUM ('VERY_UNSTABLE', 'SOMEWHAT_UNSTABLE', 'NEUTRAL', 'STABLE', 'VERY_STABLE');

-- CreateEnum
CREATE TYPE "public"."AddressType" AS ENUM ('OWNER', 'RENTED');

-- CreateEnum
CREATE TYPE "public"."LoanStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CLOSED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "password" TEXT,
    "dob" TIMESTAMP(3),
    "gender" "public"."Gender",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "verificationStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AadhaarVerification" (
    "id" SERIAL NOT NULL,
    "aadhaarNumber" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "userId" INTEGER NOT NULL,

    CONSTRAINT "AadhaarVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PanVerification" (
    "id" SERIAL NOT NULL,
    "panNumber" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "userId" INTEGER NOT NULL,

    CONSTRAINT "PanVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmploymentDetail" (
    "id" SERIAL NOT NULL,
    "employmentType" TEXT,
    "employerName" TEXT,
    "annualIncome" DOUBLE PRECISION,
    "stability" "public"."JobStability",
    "userId" INTEGER NOT NULL,

    CONSTRAINT "EmploymentDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AddressDetail" (
    "id" SERIAL NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "addressType" "public"."AddressType",
    "userId" INTEGER NOT NULL,

    CONSTRAINT "AddressDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OtpVerification" (
    "id" SERIAL NOT NULL,
    "otpCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Loan" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."LoanStatus" NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "public"."User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "AadhaarVerification_aadhaarNumber_key" ON "public"."AadhaarVerification"("aadhaarNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AadhaarVerification_userId_key" ON "public"."AadhaarVerification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PanVerification_panNumber_key" ON "public"."PanVerification"("panNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PanVerification_userId_key" ON "public"."PanVerification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmploymentDetail_userId_key" ON "public"."EmploymentDetail"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AddressDetail_userId_key" ON "public"."AddressDetail"("userId");

-- AddForeignKey
ALTER TABLE "public"."AadhaarVerification" ADD CONSTRAINT "AadhaarVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PanVerification" ADD CONSTRAINT "PanVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmploymentDetail" ADD CONSTRAINT "EmploymentDetail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AddressDetail" ADD CONSTRAINT "AddressDetail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OtpVerification" ADD CONSTRAINT "OtpVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Loan" ADD CONSTRAINT "Loan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
