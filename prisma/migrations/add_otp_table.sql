-- Migration: Add Otp table for SMS OTP storage
-- Created: 2026-02-09
-- Description: Adds the Otp model to store SMS OTP codes with phone number, code, expiry time, and verification status

-- Create Otp table
CREATE TABLE "Otp" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- Create index for faster lookups
CREATE INDEX "Otp_phone_expiresAt_idx" ON "Otp"("phone", "expiresAt");
