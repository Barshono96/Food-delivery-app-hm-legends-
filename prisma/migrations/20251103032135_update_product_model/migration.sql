/*
  Warnings:

  - You are about to drop the column `total_amount` on the `products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "products" DROP COLUMN "total_amount",
ADD COLUMN     "price" DOUBLE PRECISION NOT NULL DEFAULT 0;
