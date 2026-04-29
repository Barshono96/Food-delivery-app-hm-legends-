/*
  Warnings:

  - You are about to drop the column `country` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `zip_code` on the `users` table. All the data in the column will be lost.
  - The `status` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "status" AS ENUM ('ACTIVE', 'LOCKED');

-- DropIndex
DROP INDEX "users_username_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "country",
DROP COLUMN "gender",
DROP COLUMN "state",
DROP COLUMN "username",
DROP COLUMN "zip_code",
ADD COLUMN     "occupation" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "status" DEFAULT 'ACTIVE';
