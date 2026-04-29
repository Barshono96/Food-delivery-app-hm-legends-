/*
  Warnings:

  - You are about to drop the `delivery_items` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "delivery_items" DROP CONSTRAINT "delivery_items_delivery_id_fkey";

-- DropForeignKey
ALTER TABLE "delivery_items" DROP CONSTRAINT "delivery_items_order_item_id_fkey";

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "received_at" TIMESTAMP(3);

-- DropTable
DROP TABLE "delivery_items";
