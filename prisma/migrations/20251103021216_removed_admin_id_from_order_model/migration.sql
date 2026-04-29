/*
  Warnings:

  - You are about to drop the column `admin_id` on the `orders` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_admin_id_fkey";

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "admin_id";
