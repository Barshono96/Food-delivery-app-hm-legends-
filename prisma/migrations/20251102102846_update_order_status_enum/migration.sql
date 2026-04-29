/*
  Warnings:

  - You are about to drop the column `deleted_at` on the `orders` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'APPROVED';

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "deleted_at";
