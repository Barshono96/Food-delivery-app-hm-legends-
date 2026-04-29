-- CreateTable
CREATE TABLE "delivery_tracking" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "current_lat" DOUBLE PRECISION,
    "current_lon" DOUBLE PRECISION,
    "checkpoint1_lat" DOUBLE PRECISION,
    "checkpoint1_lon" DOUBLE PRECISION,
    "checkpoint2_lat" DOUBLE PRECISION,
    "checkpoint2_lon" DOUBLE PRECISION,
    "checkpoint3_lat" DOUBLE PRECISION,
    "checkpoint3_lon" DOUBLE PRECISION,
    "destination_lat" DOUBLE PRECISION,
    "destination_lon" DOUBLE PRECISION,
    "eta_checkpoint1" TIMESTAMP(3),
    "eta_checkpoint2" TIMESTAMP(3),
    "eta_checkpoint3" TIMESTAMP(3),
    "eta_destination" TIMESTAMP(3),
    "reached_checkpoint1" TIMESTAMP(3),
    "reached_checkpoint2" TIMESTAMP(3),
    "reached_checkpoint3" TIMESTAMP(3),
    "reached_destination" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_tracking_delivery_id_key" ON "delivery_tracking"("delivery_id");

-- CreateIndex
CREATE INDEX "delivery_tracking_driver_id_idx" ON "delivery_tracking"("driver_id");

-- AddForeignKey
ALTER TABLE "delivery_tracking" ADD CONSTRAINT "delivery_tracking_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_tracking" ADD CONSTRAINT "delivery_tracking_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
