// import {
//   BadRequestException,
//   Injectable,
//   NotFoundException,
//   UnauthorizedException,
// } from '@nestjs/common';
// import { CreateDeliveryDto } from './dto/create-delivery.dto';
// import {
//   CheckType,
//   MarkReceivedOrDeliveredDto,
// } from './dto/update-delivery.dto';
// import { FindAllQueryDeliveryDto } from './dto/query-delivery.dto';
// import { PrismaService } from 'src/prisma/prisma.service';
// import { DeliveryStatus, OrderStatus, Prisma } from '@prisma/client';
// import { NotificationGateway } from '../notification/notification.gateway';
// import {
//   NotificationPayload,
//   NotificationRepository,
// } from 'src/common/repository/notification/notification.repository';
// import { Role } from 'src/common/guard/role/role.enum';
// import { UserRepository } from 'src/common/repository/user/user.repository';
// import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
// import { StringHelper } from 'src/common/helper/string.helper';
// import appConfig from 'src/config/app.config';

// @Injectable()
// export class DeliveryService {
//   constructor(
//     private prisma: PrismaService,
//     private notificationGateway: NotificationGateway,
//   ) {}

//   private async _sendNotification(payload: NotificationPayload) {
//     await NotificationRepository.createNotification(payload);
//     const socketId = this.notificationGateway.getSocketId(payload.receiver_id);
//     if (socketId) {
//       this.notificationGateway.server
//         .to(socketId)
//         .emit('notification', JSON.stringify(payload));
//     }
//   }
//   async assignToDriver(createDeliveryDto: CreateDeliveryDto, user_id: string) {
//     const { order_id, driver_id } = createDeliveryDto;

//     const newOrder = await this.prisma.$transaction(async (prisma) => {
//       const order = await prisma.order.findUnique({
//         where: {
//           id: order_id,
//           status: OrderStatus.APPROVED,
//         },
//         select: {
//           id: true,
//           user_id: true,
//         },
//       });

//       if (!order) {
//         throw new BadRequestException('Order not found or not approved');
//       }

//       await prisma.delivery.create({
//         data: {
//           order: { connect: { id: order.id } },
//           admin: { connect: { id: user_id } },
//           driver: { connect: { id: driver_id } },
//           status: DeliveryStatus.ASSIGNED,
//         },
//       });

//       return await prisma.order.update({
//         where: { id: order.id },
//         data: { status: OrderStatus.PROCESSING },
//         select: {
//           id: true,
//           total_quantity: true,
//           status: true,
//           user: {
//             select: {
//               id: true,
//               name: true,
//               city: true,
//               address: true,
//             },
//           },
//           order_items: {
//             select: {
//               id: true,
//               quantity: true,
//               product: {
//                 select: {
//                   id: true,
//                   name: true,
//                 },
//               },
//             },
//           },
//         },
//       });
//     });
//     const notificationPayload: NotificationPayload = {
//       text: `Your order ${order_id} has been assigned to a driver.`,
//       receiver_id: newOrder.user.id,
//       sender_id: user_id,
//       entity_id: newOrder.id,
//     };
//     await this._sendNotification(notificationPayload);

//     notificationPayload.text = `You have been assigned to a new delivery for order ${order_id}.`;
//     notificationPayload.receiver_id = driver_id;
//     await this._sendNotification(notificationPayload);

//     return {
//       success: true,
//       message: 'Delivery assigned successfully',
//       data: newOrder,
//     };
//   }

//   async findAllDeliveries(
//     findAllQueryDeliveryDto: FindAllQueryDeliveryDto,
//     user_id: string,
//   ) {
//     const userDetails = await UserRepository.getUserDetails(user_id);
//     if (!userDetails) {
//       throw new UnauthorizedException('User not found');
//     }
//     const userRole = userDetails.type as Role;
//     const { cursor, limit = 10 } = findAllQueryDeliveryDto;

//     const where: Prisma.OrderWhereInput = {};
//     const select: Prisma.OrderSelect = {
//       id: true,
//       total_quantity: true,
//       user: {
//         select: {
//           id: true,
//           name: true,
//           city: true,
//           address: true,
//         },
//       },
//     };

//     if (userRole === Role.ADMIN) {
//       where.status = { not: OrderStatus.PENDING };
//       (select.status = true),
//         (select.order_items = {
//           select: {
//             id: true,
//             quantity: true,
//             product: {
//               select: {
//                 id: true,
//                 name: true,
//               },
//             },
//           },
//         });
//     } else if (userRole === Role.DRIVER) {
//       where.delivery = { driver_id: user_id };
//       select.delivery = {
//         select: {
//           id: true,
//           status: true,
//           signature_url: true, // Include signature_url in select
//         },
//       };
//     } else {
//       throw new UnauthorizedException('Permission denied');
//     }

//     const deliveries = await this.prisma.order.findMany({
//       where,
//       select,
//       orderBy: {
//         created_at: 'desc',
//       },
//       take: limit + 1,
//       ...(cursor && { skip: 1, cursor: { id: cursor } }),
//     });

//     const hasNextPage = deliveries.length > limit;
//     const data = hasNextPage ? deliveries.slice(0, -1) : deliveries;

//     return {
//       success: true,
//       message: 'Deliveries fetched successfully',
//       data: data.map((order) => ({
//         ...order,
//         delivery: order.delivery
//           ? {
//               ...order.delivery,
//               signature_url: order.delivery.signature_url
//                 ? SojebStorage.url(
//                     appConfig().storageUrl.delivery +
//                       '/' +
//                       order.delivery.signature_url,
//                   )
//                 : null,
//             }
//           : null,
//       })),
//       cursor: hasNextPage ? data[data.length - 1].id : null,
//     };
//   }

//   async findOneDelivery(id: string, user_id: string) {
//     const userDetails = await UserRepository.getUserDetails(user_id);
//     if (!userDetails) {
//       throw new UnauthorizedException('User not found');
//     }

//     const delivery = await this.prisma.delivery.findUnique({
//       where: {
//         id,
//         driver_id: user_id,
//       },
//       select: {
//         id: true,
//         status: true,
//         received_at: true,
//         delivered_at: true,
//         signature_url: true, // Include signature_url in select
//         order: {
//           select: {
//             user: {
//               select: {
//                 id: true,
//                 name: true,
//                 city: true,
//                 address: true,
//               },
//             },
//             total_quantity: true,
//             order_items: {
//               select: {
//                 id: true,
//                 quantity: true,
//                 product: {
//                   select: {
//                     id: true,
//                     name: true,
//                   },
//                 },
//               },
//             },
//           },
//         },
//       },
//     });
//     if (!delivery) throw new NotFoundException('Delivery not found');

//     return {
//       success: true,
//       message: 'Delivery found successfully',
//       data: {
//         ...delivery,
//         signature_url: delivery.signature_url
//           ? SojebStorage.url(
//               appConfig().storageUrl.delivery + '/' + delivery.signature_url,
//             )
//           : null,
//       },
//     };
//   }

//   async markReceivedOrDelivered(
//     id: string,
//     markReceivedOrDeliveredDto: MarkReceivedOrDeliveredDto,
//     user_id: string,
//     signature?: Express.Multer.File,
//   ) {
//     const { check_type, note } = markReceivedOrDeliveredDto;
//     const delivery = await this.prisma.delivery.findUnique({
//       where: {
//         id,
//         driver_id: user_id,
//       },
//       select: {
//         id: true,
//         status: true,
//         order_id: true,
//         admin_id: true,
//         order: {
//           select: {
//             user_id: true,
//           },
//         },
//       },
//     });

//     if (!delivery) throw new NotFoundException('Delivery not found');

//     if (
//       delivery.status !== DeliveryStatus.ASSIGNED &&
//       check_type === CheckType.RECEIVED
//     ) {
//       throw new BadRequestException('Delivery has not been assigned yet.');
//     }

//     if (
//       delivery.status !== DeliveryStatus.STARTED &&
//       check_type === CheckType.DELIVERED
//     ) {
//       throw new BadRequestException('Delivery has not been started yet.');
//     }

//     if (check_type === CheckType.RECEIVED) {
//       await this.prisma.$transaction([
//         this.prisma.delivery.update({
//           where: { id },
//           data: {
//             status: DeliveryStatus.STARTED,
//             received_at: new Date(),
//           },
//         }),
//         this.prisma.order.update({
//           where: { id: delivery.order_id },
//           data: { status: OrderStatus.SHIPPED },
//         }),
//       ]);
//       const notificationPayload: NotificationPayload = {
//         text: `Delivery for order ${delivery.order_id} has been started.`,
//         receiver_id: delivery.admin_id,
//         sender_id: user_id,
//         entity_id: delivery.id,
//       };
//       await this._sendNotification(notificationPayload);
//       notificationPayload.receiver_id = delivery.order.user_id;
//       await this._sendNotification(notificationPayload);
//     } else if (check_type === CheckType.DELIVERED) {
//       if (!signature) {
//         throw new BadRequestException(
//           'Signature file is required for delivery.',
//         );
//       }
//       const ext = signature.originalname.split('.').pop();
//       if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
//         throw new BadRequestException('Invalid image type');
//       }
//       const fileName = `${Date.now()}-${StringHelper.randomString(8)}.${ext}`;
//       const signaturePath = appConfig().storageUrl.delivery + '/' + fileName;
//       let fileSaved = false;
//       try {
//         await SojebStorage.put(signaturePath, signature.buffer);
//         fileSaved = true;
//         await this.prisma.$transaction([
//           this.prisma.delivery.update({
//             where: { id },
//             data: {
//               status: DeliveryStatus.COMPLETED,
//               note: note ?? '',
//               signature_url: fileName,
//               delivered_at: new Date(),
//             },
//           }),
//           this.prisma.order.update({
//             where: { id: delivery.order_id },
//             data: { status: OrderStatus.DELIVERED },
//           }),
//         ]);
//         const notificationPayload: NotificationPayload = {
//           text: `Delivery for order ${delivery.order_id} has been completed.`,
//           receiver_id: delivery.admin_id,
//           sender_id: user_id,
//           entity_id: delivery.id,
//         };
//         await this._sendNotification(notificationPayload);
//         notificationPayload.receiver_id = delivery.order.user_id;
//         await this._sendNotification(notificationPayload);
//       } catch (error) {
//         if (fileSaved) {
//           await SojebStorage.delete(
//             appConfig().storageUrl.delivery + '/' + signaturePath,
//           );
//         }
//         throw error;
//       }
//     }
//     return {
//       success: true,
//       message: `Delivery successfully marked as ${check_type}`,
//     };
//   }
// }

//===================================================================================================================================

// import {
//   BadRequestException,
//   Injectable,
//   NotFoundException,
//   UnauthorizedException,
// } from '@nestjs/common';
// import { CreateDeliveryDto } from './dto/create-delivery.dto';
// import {
//   CheckType,
//   MarkReceivedOrDeliveredDto,
// } from './dto/update-delivery.dto';
// import { FindAllQueryDeliveryDto } from './dto/query-delivery.dto';
// import { PrismaService } from 'src/prisma/prisma.service';
// import { DeliveryStatus, OrderStatus, Prisma } from '@prisma/client';
// import {
//   NotificationPayload,
//   NotificationRepository,
// } from 'src/common/repository/notification/notification.repository';
// import { Role } from 'src/common/guard/role/role.enum';
// import { UserRepository } from 'src/common/repository/user/user.repository';
// import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
// import { StringHelper } from 'src/common/helper/string.helper';
// import appConfig from 'src/config/app.config';
// import { NotificationService } from '../notification/notification.service';

// @Injectable()
// export class DeliveryService {
//   constructor(
//     private prisma: PrismaService,
//     private notificationService: NotificationService, // ✔ Firebase instead of gateway
//   ) {}

//   /**
//    * SEND NOTIFICATION (Firebase + DB)
//    * Replaces WebSocket logic
//    */
//   private async _sendNotification(payload: NotificationPayload) {
//     // Save DB notification
//     await NotificationRepository.createNotification(payload);

//     // Send Firebase push
//     await this.notificationService.sendNotification({
//       ...payload,
//       title: 'Notification',
//       body: payload.text,
//       type: payload.type || 'delivery',
//     });
//   }

//   // -----------------------------------------------------------
//   // ASSIGN DELIVERY TO DRIVER + CREATE DELIVERY TRACKING
//   // -----------------------------------------------------------
//   async assignToDriver(createDeliveryDto: CreateDeliveryDto, user_id: string) {
//     const { order_id, driver_id } = createDeliveryDto;

//     const newOrder = await this.prisma.$transaction(async (prisma) => {
//       const order = await prisma.order.findUnique({
//         where: {
//           id: order_id,
//           status: OrderStatus.APPROVED,
//         },
//         select: {
//           id: true,
//           user_id: true,
//         },
//       });

//       if (!order) {
//         throw new BadRequestException('Order not found or not approved');
//       }

//       // CREATE DELIVERY
//       const deliveryRecord = await prisma.delivery.create({
//         data: {
//           order: { connect: { id: order.id } },
//           admin: { connect: { id: user_id } },
//           driver: { connect: { id: driver_id } },
//           status: DeliveryStatus.ASSIGNED,
//         },
//         select: {
//           id: true,
//           driver_id: true,
//         },
//       });

//       // CREATE DELIVERY TRACKING ENTRY
//       await prisma.deliveryTracking.create({
//         data: {
//           delivery_id: deliveryRecord.id,
//           driver_id: deliveryRecord.driver_id,
//         },
//       });

//       // UPDATE ORDER STATUS
//       return await prisma.order.update({
//         where: { id: order.id },
//         data: { status: OrderStatus.PROCESSING },
//         select: {
//           id: true,
//           total_quantity: true,
//           status: true,
//           user: {
//             select: {
//               id: true,
//               name: true,
//               city: true,
//               address: true,
//             },
//           },
//           order_items: {
//             select: {
//               id: true,
//               quantity: true,
//               product: {
//                 select: { id: true, name: true },
//               },
//             },
//           },
//         },
//       });
//     });

//     // CUSTOMER NOTIFICATION
//     await this._sendNotification({
//       text: `Your order ${order_id} has been assigned to a driver.`,
//       receiver_id: newOrder.user.id,
//       sender_id: user_id,
//       entity_id: newOrder.id,
//     });

//     // DRIVER NOTIFICATION
//     await this._sendNotification({
//       text: `You have been assigned to a new delivery for order ${order_id}.`,
//       receiver_id: driver_id,
//       sender_id: user_id,
//       entity_id: newOrder.id,
//     });

//     return {
//       success: true,
//       message: 'Delivery assigned successfully',
//       data: newOrder,
//     };
//   }

//   // -----------------------------------------------------------
//   // GET ALL DELIVERIES
//   // -----------------------------------------------------------
//   async findAllDeliveries(
//     findAllQueryDeliveryDto: FindAllQueryDeliveryDto,
//     user_id: string,
//   ) {
//     const userDetails = await UserRepository.getUserDetails(user_id);
//     if (!userDetails) throw new UnauthorizedException('User not found');

//     const userRole = userDetails.type as Role;
//     const { cursor, limit = 10 } = findAllQueryDeliveryDto;

//     const where: Prisma.OrderWhereInput = {};
//     const select: Prisma.OrderSelect = {
//       id: true,
//       total_quantity: true,
//       user: {
//         select: {
//           id: true,
//           name: true,
//           city: true,
//           address: true,
//         },
//       },
//     };

//     if (userRole === Role.ADMIN) {
//       where.status = { not: OrderStatus.PENDING };
//       select.status = true;
//       select.order_items = {
//         select: {
//           id: true,
//           quantity: true,
//           product: { select: { id: true, name: true } },
//         },
//       };
//     } else if (userRole === Role.DRIVER) {
//       where.delivery = { driver_id: user_id };
//       select.delivery = {
//         select: {
//           id: true,
//           status: true,
//           signature_url: true,
//         },
//       };
//     } else {
//       throw new UnauthorizedException('Permission denied');
//     }

//     const deliveries = await this.prisma.order.findMany({
//       where,
//       select,
//       orderBy: { created_at: 'desc' },
//       take: limit + 1,
//       ...(cursor && { skip: 1, cursor: { id: cursor } }),
//     });

//     const hasNextPage = deliveries.length > limit;
//     const data = hasNextPage ? deliveries.slice(0, -1) : deliveries;

//     return {
//       success: true,
//       message: 'Deliveries fetched successfully',
//       data: data.map((order) => ({
//         ...order,
//         delivery: order.delivery
//           ? {
//               ...order.delivery,
//               signature_url: order.delivery.signature_url
//                 ? SojebStorage.url(
//                     appConfig().storageUrl.delivery +
//                       '/' +
//                       order.delivery.signature_url,
//                   )
//                 : null,
//             }
//           : null,
//       })),
//       cursor: hasNextPage ? data[data.length - 1].id : null,
//     };
//   }

//   // -----------------------------------------------------------
//   // GET ONE DELIVERY DETAILS
//   // -----------------------------------------------------------
//   async findOneDelivery(id: string, user_id: string) {
//     const userDetails = await UserRepository.getUserDetails(user_id);
//     if (!userDetails) throw new UnauthorizedException('User not found');

//     const delivery = await this.prisma.delivery.findUnique({
//       where: {
//         id,
//         driver_id: user_id,
//       },
//       select: {
//         id: true,
//         status: true,
//         received_at: true,
//         delivered_at: true,
//         signature_url: true,
//         order: {
//           select: {
//             user: {
//               select: {
//                 id: true,
//                 name: true,
//                 city: true,
//                 address: true,
//               },
//             },
//             total_quantity: true,
//             order_items: {
//               select: {
//                 id: true,
//                 quantity: true,
//                 product: { select: { id: true, name: true } },
//               },
//             },
//           },
//         },
//       },
//     });

//     if (!delivery) throw new NotFoundException('Delivery not found');

//     return {
//       success: true,
//       message: 'Delivery found successfully',
//       data: {
//         ...delivery,
//         signature_url: delivery.signature_url
//           ? SojebStorage.url(
//               appConfig().storageUrl.delivery + '/' + delivery.signature_url,
//             )
//           : null,
//       },
//     };
//   }

//   // -----------------------------------------------------------
//   // MARK AS RECEIVED / DELIVERED
//   // -----------------------------------------------------------
//   async markReceivedOrDelivered(
//     id: string,
//     dto: MarkReceivedOrDeliveredDto,
//     user_id: string,
//     signature?: Express.Multer.File,
//   ) {
//     const { check_type, note } = dto;
//     if (!check_type) throw new BadRequestException('Check type is required');

//     const delivery = await this.prisma.delivery.findUnique({
//       where: { id, driver_id: user_id },
//       select: {
//         id: true,
//         status: true,
//         order_id: true,
//         admin_id: true,
//         order: { select: { user_id: true } },
//       },
//     });

//     if (delivery.status == DeliveryStatus.COMPLETED)
//       throw new BadRequestException('Delivery has already been completed');

//     if (!delivery) throw new NotFoundException('Delivery not found');

//     // ---------------------- RECEIVED ----------------------
//     if (check_type === CheckType.RECEIVED) {
//       if (delivery.status === DeliveryStatus.STARTED) {
//         throw new BadRequestException('Delivery has already been received');
//       }
//       if (delivery.status !== DeliveryStatus.ASSIGNED) {
//         throw new BadRequestException('Delivery has not been assigned yet');
//       }

//       await this.prisma.$transaction([
//         this.prisma.delivery.update({
//           where: { id },
//           data: {
//             status: DeliveryStatus.STARTED,
//             received_at: new Date(),
//           },
//         }),
//         this.prisma.order.update({
//           where: { id: delivery.order_id },
//           data: { status: OrderStatus.SHIPPED },
//         }),
//       ]);

//       await this._sendNotification({
//         text: `Delivery for order ${delivery.order_id} has been started.`,
//         receiver_id: delivery.admin_id,
//         sender_id: user_id,
//         entity_id: delivery.id,
//       });

//       await this._sendNotification({
//         text: `Delivery for your order ${delivery.order_id} has started.`,
//         receiver_id: delivery.order.user_id,
//         sender_id: user_id,
//         entity_id: delivery.id,
//       });
//     }

//     // ---------------------- DELIVERED ----------------------
//     else if (check_type === CheckType.DELIVERED) {
//       if (delivery.status !== DeliveryStatus.STARTED) {
//         throw new BadRequestException('Delivery has not been started yet.');
//       }

//       if (!signature) {
//         throw new BadRequestException('Signature file is required.');
//       }

//       const ext = signature.originalname.split('.').pop();
//       if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
//         throw new BadRequestException('Invalid image type');
//       }

//       const fileName = `${Date.now()}-${StringHelper.randomString(8)}.${ext}`;
//       const signaturePath = appConfig().storageUrl.delivery + '/' + fileName;

//       let fileSaved = false;

//       try {
//         await SojebStorage.put(signaturePath, signature.buffer);
//         fileSaved = true;

//         await this.prisma.$transaction([
//           this.prisma.delivery.update({
//             where: { id },
//             data: {
//               status: DeliveryStatus.COMPLETED,
//               note: note ?? '',
//               signature_url: fileName,
//               delivered_at: new Date(),
//             },
//           }),
//           this.prisma.order.update({
//             where: { id: delivery.order_id },
//             data: { status: OrderStatus.DELIVERED },
//           }),
//         ]);

//         await this._sendNotification({
//           text: `Delivery for order ${delivery.order_id} has been completed.`,
//           receiver_id: delivery.admin_id,
//           sender_id: user_id,
//           entity_id: delivery.id,
//         });

//         await this._sendNotification({
//           text: `Your order ${delivery.order_id} has been successfully delivered.`,
//           receiver_id: delivery.order.user_id,
//           sender_id: user_id,
//           entity_id: delivery.id,
//         });
//       } catch (error) {
//         if (fileSaved) {
//           await SojebStorage.delete(signaturePath);
//         }
//         throw error;
//       }
//     }

//     return {
//       success: true,
//       message: `Delivery successfully marked as ${check_type}`,
//     };
//   }
// }

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import {
  CheckType,
  MarkReceivedOrDeliveredDto,
} from './dto/update-delivery.dto';
import { FindAllQueryDeliveryDto } from './dto/query-delivery.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { DeliveryStatus, OrderStatus, Prisma } from '@prisma/client';
import {
  NotificationPayload,
  NotificationRepository,
} from 'src/common/repository/notification/notification.repository';
import { Role } from 'src/common/guard/role/role.enum';
import { UserRepository } from 'src/common/repository/user/user.repository';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import { StringHelper } from 'src/common/helper/string.helper';
import appConfig from 'src/config/app.config';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class DeliveryService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService, // ✔ Firebase instead of gateway
  ) {}

  /**
   * SEND NOTIFICATION (Firebase Only)
   * DB Save is handled in NotificationService
   */
  private async _sendNotification(payload: NotificationPayload) {
    // Only send Firebase push - DB save is handled in NotificationService
    await this.notificationService.sendNotification({
      ...payload,
      title: 'Notification',
      body: payload.text,
      type: payload.type || 'delivery',
    });
  }

  // -----------------------------------------------------------
  // ASSIGN DELIVERY TO DRIVER + CREATE DELIVERY TRACKING
  // -----------------------------------------------------------
  async assignToDriver(createDeliveryDto: CreateDeliveryDto, user_id: string) {
    const { order_id, driver_id } = createDeliveryDto;

    const newOrder = await this.prisma.$transaction(async (prisma) => {
      const order = await prisma.order.findUnique({
        where: {
          id: order_id,
          status: OrderStatus.APPROVED,
        },
        select: {
          id: true,
          user_id: true,
        },
      });

      if (!order) {
        throw new BadRequestException('Order not found or not approved');
      }

      // CREATE DELIVERY
      const deliveryRecord = await prisma.delivery.create({
        data: {
          order: { connect: { id: order.id } },
          admin: { connect: { id: user_id } },
          driver: { connect: { id: driver_id } },
          status: DeliveryStatus.ASSIGNED,
        },
        select: {
          id: true,
          driver_id: true,
        },
      });

      // CREATE DELIVERY TRACKING ENTRY
      await prisma.deliveryTracking.create({
        data: {
          delivery_id: deliveryRecord.id,
          driver_id: deliveryRecord.driver_id,
        },
      });

      // UPDATE ORDER STATUS
      return await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PROCESSING },
        select: {
          id: true,
          total_quantity: true,
          status: true,
          user: {
            select: {
              id: true,
              name: true,
              city: true,
              address: true,
            },
          },
          order_items: {
            select: {
              id: true,
              quantity: true,
              product: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });
    });

    // CUSTOMER NOTIFICATION
    await this._sendNotification({
      text: `Your order ${order_id} has been assigned to a driver.`,
      receiver_id: newOrder.user.id,
      sender_id: user_id,
      entity_id: newOrder.id,
    });

    // DRIVER NOTIFICATION
    await this._sendNotification({
      text: `You have been assigned to a new delivery for order ${order_id}.`,
      receiver_id: driver_id,
      sender_id: user_id,
      entity_id: newOrder.id,
    });

    return {
      success: true,
      message: 'Delivery assigned successfully',
      data: newOrder,
    };
  }

  // -----------------------------------------------------------
  // GET ALL DELIVERIES
  // -----------------------------------------------------------
  async findAllDeliveries(
    findAllQueryDeliveryDto: FindAllQueryDeliveryDto,
    user_id: string,
  ) {
    const userDetails = await UserRepository.getUserDetails(user_id);
    if (!userDetails) throw new UnauthorizedException('User not found');

    const userRole = userDetails.type as Role;
    const { cursor, limit = 10 } = findAllQueryDeliveryDto;

    const where: Prisma.OrderWhereInput = {};
    const select: Prisma.OrderSelect = {
      id: true,
      total_quantity: true,
      user: {
        select: {
          id: true,
          name: true,
          city: true,
          address: true,
        },
      },
    };

    let orderByClause: any = { created_at: 'desc' };

    if (userRole === Role.ADMIN) {
      where.status = { not: OrderStatus.PENDING };
      select.status = true;
      select.order_items = {
        select: {
          id: true,
          quantity: true,
          product: { select: { id: true, name: true } },
        },
      };
    } else if (userRole === Role.DRIVER) {
      where.delivery = { driver_id: user_id };
      select.delivery = {
        select: {
          id: true,
          status: true,
          signature_url: true,
          created_at: true,
        },
      };
      // For DRIVER, sort by delivery.created_at instead of order.created_at
      orderByClause = { delivery: { created_at: 'desc' } };
    } else {
      throw new UnauthorizedException('Permission denied');
    }

    const deliveries = await this.prisma.order.findMany({
      where,
      select,
      orderBy: orderByClause,
      take: limit + 1,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });

    const hasNextPage = deliveries.length > limit;
    const data = hasNextPage ? deliveries.slice(0, -1) : deliveries;

    return {
      success: true,
      message: 'Deliveries fetched successfully',
      data: data.map((order) => ({
        ...order,
        delivery: order.delivery
          ? {
              ...order.delivery,
              signature_url: order.delivery.signature_url
                ? SojebStorage.url(
                    appConfig().storageUrl.delivery +
                      '/' +
                      order.delivery.signature_url,
                  )
                : null,
            }
          : null,
      })),
      cursor: hasNextPage ? data[data.length - 1].id : null,
    };
  }

  // -----------------------------------------------------------
  // GET ONE DELIVERY DETAILS
  // -----------------------------------------------------------
  async findOneDelivery(id: string, user_id: string) {
    const userDetails = await UserRepository.getUserDetails(user_id);
    if (!userDetails) throw new UnauthorizedException('User not found');

    const delivery = await this.prisma.delivery.findUnique({
      where: {
        id,
        driver_id: user_id,
      },
      select: {
        id: true,
        status: true,
        received_at: true,
        delivered_at: true,
        signature_url: true,
        order: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                city: true,
                address: true,
              },
            },
            total_quantity: true,
            order_items: {
              select: {
                id: true,
                quantity: true,
                product: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!delivery) throw new NotFoundException('Delivery not found');

    return {
      success: true,
      message: 'Delivery found successfully',
      data: {
        ...delivery,
        signature_url: delivery.signature_url
          ? SojebStorage.url(
              appConfig().storageUrl.delivery + '/' + delivery.signature_url,
            )
          : null,
      },
    };
  }

  // -----------------------------------------------------------
  // MARK AS RECEIVED / DELIVERED
  // -----------------------------------------------------------
  async markReceivedOrDelivered(
    id: string,
    dto: MarkReceivedOrDeliveredDto,
    user_id: string,
    signature?: Express.Multer.File,
  ) {
    const { check_type, note } = dto;
    if (!check_type) throw new BadRequestException('Check type is required');

    const delivery = await this.prisma.delivery.findUnique({
      where: { id, driver_id: user_id },
      select: {
        id: true,
        status: true,
        order_id: true,
        admin_id: true,
        order: { select: { user_id: true } },
      },
    });

    if (delivery.status == DeliveryStatus.COMPLETED)
      throw new BadRequestException('Delivery has already been completed');

    if (!delivery) throw new NotFoundException('Delivery not found');

    // ---------------------- RECEIVED ----------------------
    if (check_type === CheckType.RECEIVED) {
      if (delivery.status === DeliveryStatus.STARTED) {
        throw new BadRequestException('Delivery has already been received');
      }
      if (delivery.status !== DeliveryStatus.ASSIGNED) {
        throw new BadRequestException('Delivery has not been assigned yet');
      }

      await this.prisma.$transaction([
        this.prisma.delivery.update({
          where: { id },
          data: {
            status: DeliveryStatus.STARTED,
            received_at: new Date(),
          },
        }),
        this.prisma.order.update({
          where: { id: delivery.order_id },
          data: { status: OrderStatus.SHIPPED },
        }),
      ]);

      await this._sendNotification({
        text: `Delivery for order ${delivery.order_id} has been started.`,
        receiver_id: delivery.admin_id,
        sender_id: user_id,
        entity_id: delivery.id,
      });

      await this._sendNotification({
        text: `Delivery for your order ${delivery.order_id} has started.`,
        receiver_id: delivery.order.user_id,
        sender_id: user_id,
        entity_id: delivery.id,
      });
    }

    // ---------------------- DELIVERED ----------------------
    else if (check_type === CheckType.DELIVERED) {
      if (delivery.status !== DeliveryStatus.STARTED) {
        throw new BadRequestException('Delivery has not been started yet.');
      }

      if (!signature) {
        throw new BadRequestException('Signature file is required.');
      }

      const ext = signature.originalname.split('.').pop();
      if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        throw new BadRequestException('Invalid image type');
      }

      const fileName = `${Date.now()}-${StringHelper.randomString(8)}.${ext}`;
      const signaturePath = appConfig().storageUrl.delivery + '/' + fileName;

      let fileSaved = false;

      try {
        await SojebStorage.put(signaturePath, signature.buffer);
        fileSaved = true;

        await this.prisma.$transaction([
          this.prisma.delivery.update({
            where: { id },
            data: {
              status: DeliveryStatus.COMPLETED,
              note: note ?? '',
              signature_url: fileName,
              delivered_at: new Date(),
            },
          }),
          this.prisma.order.update({
            where: { id: delivery.order_id },
            data: { status: OrderStatus.DELIVERED },
          }),
        ]);

        await this._sendNotification({
          text: `Delivery for order ${delivery.order_id} has been completed.`,
          receiver_id: delivery.admin_id,
          sender_id: user_id,
          entity_id: delivery.id,
        });

        await this._sendNotification({
          text: `Your order ${delivery.order_id} has been successfully delivered.`,
          receiver_id: delivery.order.user_id,
          sender_id: user_id,
          entity_id: delivery.id,
        });
      } catch (error) {
        if (fileSaved) {
          await SojebStorage.delete(signaturePath);
        }
        throw error;
      }
    }

    return {
      success: true,
      message: `Delivery successfully marked as ${check_type}`,
    };
  }
}
