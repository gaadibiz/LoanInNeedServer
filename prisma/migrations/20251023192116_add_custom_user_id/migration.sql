/*
  Warnings:

  - A unique constraint covering the columns `[customUserId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "customUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_customUserId_key" ON "public"."User"("customUserId");
