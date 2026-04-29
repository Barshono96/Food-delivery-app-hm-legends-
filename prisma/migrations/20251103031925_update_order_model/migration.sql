/*
  Warnings:

  - You are about to alter the column `price` on the `order_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to alter the column `total_amount` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to drop the column `price` on the `products` table. All the data in the column will be lost.
  - Made the column `quantity` on table `order_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `price` on table `order_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `total_amount` on table `orders` required. This step will fail if there are existing NULL values in that column.
  - Made the column `total_quantity` on table `orders` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_order_id_fkey";

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_id_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_user_id_fkey";

-- AlterTable
ALTER TABLE "order_items" ALTER COLUMN "quantity" SET NOT NULL,
ALTER COLUMN "price" SET NOT NULL,
ALTER COLUMN "price" SET DEFAULT 0,
ALTER COLUMN "price" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "product_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "total_amount" SET NOT NULL,
ALTER COLUMN "total_amount" SET DEFAULT 0,
ALTER COLUMN "total_amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "total_quantity" SET NOT NULL;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "price",
ADD COLUMN     "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
