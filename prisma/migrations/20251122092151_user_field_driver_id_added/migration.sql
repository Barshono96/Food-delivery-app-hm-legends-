/*
  Warnings:

  - A unique constraint covering the columns `[driver_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "driver_id" VARCHAR(6);

-- CreateIndex
CREATE UNIQUE INDEX "users_driver_id_key" ON "users"("driver_id");
