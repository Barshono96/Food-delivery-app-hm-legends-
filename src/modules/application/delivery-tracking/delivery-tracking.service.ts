// import { Injectable } from '@nestjs/common';
// import axios from 'axios';
// import { PrismaService } from 'src/prisma/prisma.service';
// import { NotificationGateway } from '../notification/notification.gateway';
// import { UpdateLocationDto } from './dto/update-location.dto';

// @Injectable()
// export class DeliveryTrackingService {
//   constructor(
//     private prisma: PrismaService,
//     private gateway: NotificationGateway,
//   ) { }

//   // ---------------------------------------------------------
//   // DRIVER LOCATION UPDATE
//   // ---------------------------------------------------------
//   async updateDriverLocation(dto: UpdateLocationDto) {
//     const tracking = await this.prisma.deliveryTracking.findUnique({
//       where: { delivery_id: dto.deliveryId },
//       include: {
//         delivery: {
//           include: { driver: true },
//         },
//       },
//     });

//     if (!tracking)
//       return { success: false, message: 'Delivery tracking not found' };

//     // 1. Update current location
//     await this.prisma.deliveryTracking.update({
//       where: { delivery_id: dto.deliveryId },
//       data: {
//         current_lat: dto.lat,
//         current_lon: dto.lon,
//         updated_at: new Date(),
//       },
//     });

//     // 2. Calculate ETA
//     const eta = await this.calculateETAs(dto, tracking);

//     // 3. Check if reached checkpoint
//     const reached = await this.checkReached(dto, tracking);

//     // 4. Send Real-Time WebSocket Update
//     this.sendSocketUpdate(tracking.driver_id, {
//       deliveryId: dto.deliveryId,
//       currentLocation: { lat: dto.lat, lon: dto.lon },
//       eta,
//       reached,
//     });

//     return { success: true, eta, reached };
//   }

//   // ---------------------------------------------------------
//   // ETA CALCULATION (GOOGLE API)
//   // ---------------------------------------------------------
//   // async calculateETAs(dto, tracking) {
//   //   const getETA = async (destLat, destLon) => {
//   //     if (!destLat || !destLon) return null;

//   //     const url = `https://maps.googleapis.com/maps/api/distancematrix/json
//   //     ?origins=${dto.lat},${dto.lon}
//   //     &destinations=${destLat},${destLon}
//   //     &key=${process.env.GOOGLE_MAPS_KEY}`;

//   //     const res = await axios.get(url);
//   //     const duration = res.data.rows[0].elements[0].duration;

//   //     return new Date(Date.now() + duration.value * 1000);
//   //   };

//   //   const eta1 = await getETA(tracking.checkpoint1_lat, tracking.checkpoint1_lon);
//   //   const eta2 = await getETA(tracking.checkpoint2_lat, tracking.checkpoint2_lon);
//   //   const eta3 = await getETA(tracking.checkpoint3_lat, tracking.checkpoint3_lon);
//   //   const etaDest = await getETA(tracking.destination_lat, tracking.destination_lon);

//   //   await this.prisma.deliveryTracking.update({
//   //     where: { delivery_id: tracking.delivery_id },
//   //     data: {
//   //       eta_checkpoint1: eta1,
//   //       eta_checkpoint2: eta2,
//   //       eta_checkpoint3: eta3,
//   //       eta_destination: etaDest,
//   //     },
//   //   });

//   //   return {
//   //     checkpoint1: eta1,
//   //     checkpoint2: eta2,
//   //     checkpoint3: eta3,
//   //     destination: etaDest,
//   //   };
//   // }

//   async calculateETAs(dto, tracking) {
//     const getETA = async (destLat, destLon) => {
//       if (!destLat || !destLon) return null;

//       const url = `http://router.project-osrm.org/route/v1/driving/${dto.lon},${dto.lat};${destLon},${destLat}?overview=false`;

//       try {
//         const res = await axios.get(url);

//         const route = res.data.routes?.[0];
//         if (!route) return null;

//         const durationSec = route.duration; // seconds

//         return new Date(Date.now() + durationSec * 1000);
//       } catch (error) {
//         console.log("OSRM ERROR:", error.message);
//         return null;
//       }
//     };

//     const eta1 = await getETA(tracking.checkpoint1_lat, tracking.checkpoint1_lon);
//     const eta2 = await getETA(tracking.checkpoint2_lat, tracking.checkpoint2_lon);
//     const eta3 = await getETA(tracking.checkpoint3_lat, tracking.checkpoint3_lon);
//     const etaDest = await getETA(tracking.destination_lat, tracking.destination_lon);

//     await this.prisma.deliveryTracking.update({
//       where: { delivery_id: tracking.delivery_id },
//       data: {
//         eta_checkpoint1: eta1,
//         eta_checkpoint2: eta2,
//         eta_checkpoint3: eta3,
//         eta_destination: etaDest,
//       },
//     });

//     return {
//       checkpoint1: eta1,
//       checkpoint2: eta2,
//       checkpoint3: eta3,
//       destination: etaDest,
//     };
//   }


//   // ---------------------------------------------------------
//   // CHECKPOINT REACHED DETECTION (50 METER)
//   // ---------------------------------------------------------
//   async checkReached(dto, tracking) {
//     const RADIUS_KM = 0.05; // 50 meters

//     const haversine = (lat1, lon1, lat2, lon2) => {
//       if (!lat2 || !lon2) return Infinity;
//       const toRad = (x) => (x * Math.PI) / 180;
//       const R = 6371;

//       const dLat = toRad(lat2 - lat1);
//       const dLon = toRad(lon2 - lon1);

//       const a =
//         Math.sin(dLat / 2) ** 2 +
//         Math.cos(toRad(lat1)) *
//         Math.cos(toRad(lat2)) *
//         Math.sin(dLon / 2) ** 2;

//       return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//     };

//     const reached: any = {};

//     const checkpoints = [
//       { key: 'reached_checkpoint1', lat: tracking.checkpoint1_lat, lon: tracking.checkpoint1_lon },
//       { key: 'reached_checkpoint2', lat: tracking.checkpoint2_lat, lon: tracking.checkpoint2_lon },
//       { key: 'reached_checkpoint3', lat: tracking.checkpoint3_lat, lon: tracking.checkpoint3_lon },
//       { key: 'reached_destination', lat: tracking.destination_lat, lon: tracking.destination_lon },
//     ];

//     for (const cp of checkpoints) {
//       if (!tracking[cp.key] && haversine(dto.lat, dto.lon, cp.lat, cp.lon) <= RADIUS_KM) {
//         reached[cp.key] = new Date();
//         await this.prisma.deliveryTracking.update({
//           where: { delivery_id: tracking.delivery_id },
//           data: { [cp.key]: reached[cp.key] },
//         });
//       }
//     }

//     return reached;
//   }

//   // ---------------------------------------------------------
//   // WEBSOCKET REAL-TIME PUSH
//   // ---------------------------------------------------------
//   sendSocketUpdate(driverId: string, data: any) {
//     const socketId = this.gateway.getSocketId(driverId);
//     if (socketId) {
//       this.gateway.server.to(socketId).emit('deliveryTracking', data);
//     }
//   }

//   // ---------------------------------------------------------
//   // UPDATE CHECKPOINTS
//   // ---------------------------------------------------------
//   async updateCheckpoints(deliveryId: string, dto) {
//     const tracking = await this.prisma.deliveryTracking.findUnique({
//       where: { delivery_id: deliveryId },
//     });

//     if (!tracking) {
//       return this.prisma.deliveryTracking.create({
//         data: {
//           delivery_id: deliveryId,
//           driver_id: (await this.prisma.delivery.findUnique({
//             where: { id: deliveryId },
//           })).driver_id,
//           ...dto,
//         },
//       });
//     }

//     return this.prisma.deliveryTracking.update({
//       where: { delivery_id: deliveryId },
//       data: dto,
//     });
//   }
// }

import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class DeliveryTrackingService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService, // ✔ Firebase instead of WebSocket gateway
  ) { }

  // ---------------------------------------------------------
  // DRIVER LOCATION UPDATE
  // ---------------------------------------------------------
  async updateDriverLocation(dto: UpdateLocationDto) {
    const tracking = await this.prisma.deliveryTracking.findUnique({
      where: { delivery_id: dto.deliveryId },
      include: {
        delivery: {
          include: {
            driver: true,
            admin: true,
          },
        },
      },
    });

    if (!tracking)
      return { success: false, message: 'Delivery tracking not found' };

    // 🛑 Validation: If delivery already marked reached, stop location updates
    if (tracking.delivery_reached) {
      return {
        success: false,
        message: 'Cannot update location: Delivery has already been completed',
      };
    }

    // 1. Update current location
    await this.prisma.deliveryTracking.update({
      where: { delivery_id: dto.deliveryId },
      data: {
        current_lat: dto.lat,
        current_lon: dto.lon,
        updated_at: new Date(),
      },
    });

    // 2. Calculate ETA
    const eta = await this.calculateETAs(dto, tracking);

    // 3. Check if reached checkpoint
    const reached = await this.checkReached(dto, tracking);

    // ---------------------------------------------------------
    // 4. SEND NOTIFICATION ONLY ON KEY MILESTONES
    // ---------------------------------------------------------
    // 🔔 Notification 1: When driver reaches checkpoint 1
    if (reached.reached_checkpoint1) {
      await this.sendNotificationToAdmin(tracking.delivery.admin_id, {
        deliveryId: dto.deliveryId,
        message: 'Driver started delivery',
        type: 'checkpoint_1_reached',
      });
    }

    // 🔔 Notification 2: When driver reaches destination
    if (reached.reached_destination) {
      await this.sendNotificationToAdmin(tracking.delivery.admin_id, {
        deliveryId: dto.deliveryId,
        message: 'Driver reached destination',
        type: 'destination_reached',
      });
    }

    return { success: true, eta, reached };
  }

  // ---------------------------------------------------------
  // FIREBASE REAL-TIME PUSH
  // ---------------------------------------------------------
  async sendFirebaseUpdate(receiverId: string, payload: any) {
    await this.notificationService.sendNotification({
      receiver_id: receiverId,
      sender_id: null,
      entity_id: payload.deliveryId,
      type: 'delivery_tracking',
      title: 'Delivery Tracking Update',
      body: 'Driver location updated',
      data: payload,
    });
  }

  // ---------------------------------------------------------
  // SEND NOTIFICATION TO ADMIN ON KEY MILESTONES
  // ---------------------------------------------------------
  async sendNotificationToAdmin(
    adminId: string,
    payload: { deliveryId: string; message: string; type: string },
  ) {
    try {
      await this.notificationService.sendNotification({
        receiver_id: adminId,
        sender_id: null,
        entity_id: payload.deliveryId,
        type: payload.type,
        title: payload.type === 'checkpoint_1_reached' ? 'Checkpoint Reached' : 'Destination Reached',
        body: payload.message,
      });
    } catch (err) {
      console.error(`Failed to send notification to admin ${adminId}:`, err.message);
    }
  }

  // ---------------------------------------------------------
  // ETA CALCULATION (OSRM)
  // ---------------------------------------------------------
  async calculateETAs(dto, tracking) {
    const getETA = async (destLat, destLon) => {
      if (!destLat || !destLon) return null;

      const url = `http://router.project-osrm.org/route/v1/driving/${dto.lon},${dto.lat};${destLon},${destLat}?overview=false`;

      try {
        const res = await axios.get(url);
        const route = res.data.routes?.[0];
        if (!route) return null;

        return new Date(Date.now() + route.duration * 1000);
      } catch (error) {
        console.log('OSRM ERROR:', error.message);
        return null;
      }
    };

    const eta1 = await getETA(tracking.checkpoint1_lat, tracking.checkpoint1_lon);
    const eta2 = await getETA(tracking.checkpoint2_lat, tracking.checkpoint2_lon);
    const eta3 = await getETA(tracking.checkpoint3_lat, tracking.checkpoint3_lon);
    const etaDest = await getETA(tracking.destination_lat, tracking.destination_lon);

    await this.prisma.deliveryTracking.update({
      where: { delivery_id: tracking.delivery_id },
      data: {
        eta_checkpoint1: eta1,
        eta_checkpoint2: eta2,
        eta_checkpoint3: eta3,
        eta_destination: etaDest,
      },
    });

    return {
      checkpoint1: eta1,
      checkpoint2: eta2,
      checkpoint3: eta3,
      destination: etaDest,
    };
  }

  // CHECKPOINT REACHED DETECTION (50 METERS)

  async checkReached(dto, tracking) {
    const RADIUS_KM = 0.05; // 50m

    const haversine = (lat1, lon1, lat2, lon2) => {
      if (!lat2 || !lon2) return Infinity;
      const toRad = (x) => (x * Math.PI) / 180;
      const R = 6371;

      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const reached: any = {};
    const checkpoints = [
      { key: 'reached_checkpoint1', lat: tracking.checkpoint1_lat, lon: tracking.checkpoint1_lon },
      { key: 'reached_checkpoint2', lat: tracking.checkpoint2_lat, lon: tracking.checkpoint2_lon },
      { key: 'reached_checkpoint3', lat: tracking.checkpoint3_lat, lon: tracking.checkpoint3_lon },
      { key: 'reached_destination', lat: tracking.destination_lat, lon: tracking.destination_lon },
    ];

    for (const cp of checkpoints) {
      if (!tracking[cp.key] && haversine(dto.lat, dto.lon, cp.lat, cp.lon) <= RADIUS_KM) {
        reached[cp.key] = new Date();
        await this.prisma.deliveryTracking.update({
          where: { delivery_id: tracking.delivery_id },
          data: { [cp.key]: reached[cp.key] },
        });
      }
    }

    return reached;
  }


  // UPDATE CHECKPOINTS
  async updateCheckpoints(deliveryId: string, dto) {
    const tracking = await this.prisma.deliveryTracking.findUnique({
      where: { delivery_id: deliveryId },
    });

    if (!tracking) {
      return this.prisma.deliveryTracking.create({
        data: {
          delivery_id: deliveryId,
          driver_id: (
            await this.prisma.delivery.findUnique({ where: { id: deliveryId } })
          ).driver_id,
          ...dto,
        },
      });
    }



    return this.prisma.deliveryTracking.update({
      where: { delivery_id: deliveryId },
      data: dto,
    });
  }

  ////give a get function to fetch delivery tracking info by deliveryId
  async getTrackingInfo(deliveryId: string) {
    const tracking = await this.prisma.deliveryTracking.findUnique({
      where: { delivery_id: deliveryId },
    });
    return tracking;
  }

  // ---------------------------------------------------------
  // STOP DELIVERY (Driver calls after reaching destination)
  // ---------------------------------------------------------
  async stopDelivery(deliveryId: string, driverId: string) {
    try {
      // Fetch delivery and tracking info
      const delivery = await this.prisma.delivery.findUnique({
        where: { id: deliveryId },
        select: {
          id: true,
          driver_id: true,
          admin_id: true,
          status: true,
          order_id: true,

        },
      });

      if (!delivery) {
        return {
          success: false,
          message: 'Delivery not found',
        };
      }

      // Verify the driver owns this delivery
      if (delivery.driver_id !== driverId) {
        return {
          success: false,
          message: 'Unauthorized: This delivery does not belong to this driver',
        };
      }

      // Mark delivery as completed
      const updatedDelivery = await this.prisma.delivery.update({
        where: { id: deliveryId },
        data: {
          status: 'COMPLETED',
          delivered_at: new Date(),
        },
      });

      // Update delivery tracking and capture updated tracking
      const updatedTracking = await this.prisma.deliveryTracking.update({
        where: { delivery_id: deliveryId },
        data: {
          delivery_reached: true,
          updated_at: new Date(),
        },
      });

      // Notify admin that delivery has been completed
      await this.sendNotificationToAdmin(delivery.admin_id, {
        deliveryId: deliveryId,
        message: `Delivery for order ${delivery.order_id} has been completed by driver.`,
        type: 'delivery_completed',
      });

      return {
        success: true,
        message: 'Delivery stopped successfully',
        data: {
          delivery: updatedDelivery,
          // tracking: updatedTracking,
          delivery_reached: updatedTracking.delivery_reached,
        },
      };
    } catch (error) {
      console.error('Error stopping delivery:', error.message);
      return {
        success: false,
        message: `Failed to stop delivery: ${error.message}`,
      };
    }
  }

}