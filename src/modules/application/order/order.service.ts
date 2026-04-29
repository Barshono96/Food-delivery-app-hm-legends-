// import {
//   BadGatewayException,
//   BadRequestException,
//   Injectable,
//   NotFoundException,
//   UnauthorizedException,
// } from '@nestjs/common';
// import { PrismaService } from 'src/prisma/prisma.service';
// import { QueryOrderDto } from './dto/query-order.dto';
// import { OrderStatus, Prisma, StockStatus, status } from '@prisma/client';
// import { CreateOrderDto } from './dto/create-order.dto';
// import { NotificationPayload } from 'src/common/repository/notification/notification.repository';
// import { NotificationGateway } from '../notification/notification.gateway';
// import { NotificationRepository } from '../../../common/repository/notification/notification.repository';
// import { StringHelper } from 'src/common/helper/string.helper';

// @Injectable()
// export class OrderService {
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
//   private startOfDay(date: Date) {
//     const d = new Date(date);
//     d.setHours(0, 0, 0, 0);
//     return d;
//   }

//   private endOfDay(date: Date) {
//     const d = new Date(date);
//     d.setHours(23, 59, 59, 999);
//     return d;
//   }

//   private startOfWeek(date: Date, weekStartsOn = 1) {
//     const d = new Date(date);
//     const diff =
//       (d.getDay() < weekStartsOn ? 7 : 0) + d.getDay() - weekStartsOn;
//     d.setDate(d.getDate() - diff);
//     return this.startOfDay(d);
//   }

//   private startOfMonth(date: Date) {
//     return this.startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
//   }

//   async create(createOrderDto: CreateOrderDto, user_id: string) {
//     if (!user_id) throw new UnauthorizedException('User ID is required');

//     const user = await this.prisma.user.findUnique({
//       where: { id: user_id },
//       select: {
//         order_exist: true,
//         status: true,
//       },
//     });

//     if (user.order_exist || user.status === status.LOCKED) {
//       throw new BadRequestException(
//         'User not eligible right now to place an order',
//       );
//     }

//     const products = await Promise.all(
//       createOrderDto.products.map(async (p) => {
//         const product = await this.prisma.product.findUnique({
//           where: {
//             id: p.product_id,
//             stock_status: {
//               not: StockStatus.OUT_OF_STOCK,
//             },
//           },
//           select: { price: true, stock: true, user_id: true, name: true },
//         });

//         if (!product) {
//           throw new NotFoundException(
//             `Product not found for ID: ${p.product_id}`,
//           );
//         }

//         if (product.stock < p.quantity) {
//           throw new BadRequestException(
//             `Not enough quantity for product: ${product.name}`,
//           );
//         }

//         return {
//           ...p,
//           price: product.price,
//           user_id: product.user_id,
//         };
//       }),
//     );

//     const total_amount = products.reduce(
//       (acc, { quantity, price }) => acc + quantity * price,
//       0,
//     );

//     const total_quantity = products.reduce(
//       (acc, { quantity }) => acc + quantity,
//       0,
//     );

//     const order = await this.prisma.order.create({
//       data: {
//         user_id,
//         total_amount,
//         total_quantity,
//         order_items: {
//           create: createOrderDto.products.map((p) => ({
//             product_id: p.product_id,
//             quantity: p.quantity,
//             price: products.find((pr) => pr.product_id === p.product_id).price,
//           })),
//         },
//       },
//       select: {
//         id: true,
//         total_amount: true,
//         total_quantity: true,
//         created_at: true,
//         order_items: {
//           select: {
//             id: true,
//             quantity: true,
//             price: true,
//             product: {
//               select: {
//                 user_id: true,
//                 name: true,
//                 price: true,
//               },
//             },
//           },
//         },
//       },
//     });

//     await Promise.all(
//       createOrderDto.products.map(async (p) => {
//         const product = await this.prisma.product.update({
//           where: { id: p.product_id },
//           data: {
//             stock: {
//               decrement: p.quantity,
//             },
//           },
//         });

//         if (product.stock < 50) {
//           await this.prisma.product.update({
//             where: {
//               id: product.id,
//             },
//             data: {
//               stock_status: StockStatus.LOW_STOCK,
//             },
//           });
//           const notificationPayload: NotificationPayload = {
//             text: `Your ${product.name} stock is under 50`,
//             receiver_id: product.user_id,
//             sender_id: null,
//             entity_id: product.id,
//           };
//           await this._sendNotification(notificationPayload);
//         }
//       }),
//     );

//     const updatedUser = await this.prisma.user.update({
//       where: {
//         id: user_id,
//       },
//       data: {
//         order_exist: true,
//       },
//     });

//     const adminNotificationPayload: NotificationPayload = {
//       text: `Received a new order from ${updatedUser.name}`,
//       sender_id: updatedUser.id,
//       receiver_id: order.order_items[0].product.user_id,
//       entity_id: order.id,
//     };
//     const managerNotificationPayload: NotificationPayload = {
//       text: `Your order placed successfully`,
//       receiver_id: updatedUser.id,
//       sender_id: order.order_items[0].product.user_id,
//       entity_id: order.id,
//     };

//     await Promise.all([
//       this._sendNotification(adminNotificationPayload),
//       this._sendNotification(managerNotificationPayload),
//     ]);

//     return { success: true, message: 'Order placed successfully', order };
//   }

//   async findAllForManager(user_id: string, query?: QueryOrderDto) {
//     if (!user_id) throw new UnauthorizedException('User ID is required');

//     const { period = 'today', search } = query || {};

//     const where: Prisma.OrderWhereInput = {
//       user_id,
//     };

//     if (search) {
//       const formattedQuery = StringHelper.formatSearchQuery(search);
//       const numericSearch = Number(search);
//       const isNumeric = !isNaN(numericSearch);
//       where.OR = [
//         { id: { contains: search, mode: 'insensitive' } },
//         {
//           user: {
//             OR: [
//               { name: { search: formattedQuery } },
//               { phone_number: { contains: search, mode: 'insensitive' } },
//             ],
//           },
//         },
//         {
//           order_items: {
//             some: {
//               product: { name: { search: formattedQuery } },
//             },
//           },
//         },
//         ...(isNumeric ? [{ total_quantity: { equals: numericSearch } }] : []),
//         ...(isNumeric
//           ? [
//               {
//                 order_items: {
//                   some: { quantity: { equals: numericSearch } },
//                 },
//               },
//             ]
//           : []),
//       ];
//     } else {
//       const now = new Date();
//       let dateFilter: { gte: Date; lte: Date } | undefined;
//       if (period === 'today') {
//         dateFilter = { gte: this.startOfDay(now), lte: this.endOfDay(now) };
//       } else if (period === 'week') {
//         dateFilter = { gte: this.startOfWeek(now), lte: this.endOfDay(now) };
//       } else if (period === 'month') {
//         dateFilter = { gte: this.startOfMonth(now), lte: this.endOfDay(now) };
//       } else {
//         const parsedDate = new Date(period);
//         dateFilter = !isNaN(parsedDate.getTime())
//           ? { gte: this.startOfDay(parsedDate), lte: this.endOfDay(parsedDate) }
//           : { gte: this.startOfDay(now), lte: this.endOfDay(now) };
//       }
//       if (dateFilter) {
//         where.created_at = dateFilter;
//       }
//     }

//     const orders = await this.prisma.order.findMany({
//       where,
//       select: {
//         id: true,
//         total_amount: true,
//         total_quantity: true,
//         created_at: true,
//         order_items: {
//           select: {
//             id: true,
//             quantity: true,
//             price: true,
//             product: { select: { name: true, price: true } },
//           },
//         },
//       },
//       orderBy: { created_at: 'desc' },
//     });

//     return {
//       success: true,
//       message: 'Orders fetched successfully',
//       data: orders,
//     };
//   }

//   async findAllForAdmin(user_id: string, query?: QueryOrderDto) {
//     if (!user_id) throw new UnauthorizedException('User ID is required');
//     const { period = 'today', search } = query || {};

//     const where: Prisma.OrderWhereInput = {};

//     if (search) {
//       const formattedQuery = StringHelper.formatSearchQuery(search);
//       const numericSearch = Number(search);
//       const isNumeric = !isNaN(numericSearch);
//       where.OR = [
//         { id: { contains: search, mode: 'insensitive' } },
//         { user: { name: { search: formattedQuery } } },
//         { user: { phone_number: { contains: search, mode: 'insensitive' } } },
//         {
//           order_items: {
//             some: {
//               product: { name: { search: formattedQuery } },
//             },
//           },
//         },
//         ...(isNumeric ? [{ total_quantity: { equals: numericSearch } }] : []),
//       ];
//     } else {
//       const now = new Date();
//       let dateFilter: { gte: Date; lte: Date } | undefined;
//       if (period === 'today') {
//         dateFilter = { gte: this.startOfDay(now), lte: this.endOfDay(now) };
//       } else if (period === 'week') {
//         dateFilter = { gte: this.startOfWeek(now), lte: this.endOfDay(now) };
//       } else if (period === 'month') {
//         dateFilter = { gte: this.startOfMonth(now), lte: this.endOfDay(now) };
//       } else {
//         const parsedDate = new Date(period);
//         if (!isNaN(parsedDate.getTime())) {
//           dateFilter = {
//             gte: this.startOfDay(parsedDate),
//             lte: this.endOfDay(parsedDate),
//           };
//         } else {
//           dateFilter = { gte: this.startOfDay(now), lte: this.endOfDay(now) };
//         }
//       }
//       if (dateFilter) {
//         where.created_at = dateFilter;
//       }
//     }

//     const orders = await this.prisma.order.findMany({
//       where,
//       select: {
//         id: true,
//         total_quantity: true,
//         created_at: true,
//         status: true,
//         user: {
//           select: {
//             id: true,
//             name: true,
//           },
//         },
//       },
//       orderBy: { created_at: 'desc' },
//     });

//     if (search) {
//       return {
//         success: true,
//         message: 'Orders fetched successfully',
//         data: { orders, stats: null },
//       };
//     }

//     const total = orders.length;
//     const pending = orders.filter(
//       (o) => o.status === OrderStatus.PENDING,
//     ).length;
//     const delivered = orders.filter(
//       (o) => o.status === OrderStatus.DELIVERED,
//     ).length;

//     const invoiced = await this.prisma.invoice.count({
//       where: {
//         order_id: {
//           in: orders.map((o) => o.id),
//         },
//         status: 'PAID',
//       },
//     });

//     const total_unit_ordered = orders.reduce(
//       (sum, o) => sum + o.total_quantity,
//       0,
//     );

//     return {
//       success: true,
//       message: 'Orders fetched successfully',
//       data: {
//         orders,
//         stats: {
//           total,
//           pending,
//           invoiced,
//           delivered,
//           total_unit_ordered,
//         },
//       },
//     };
//   }
//   async findLastSevenDaysOrders() {
//     const now = new Date();
//     const startOfWeek = this.startOfWeek(now);

//     const orders = await this.prisma.order.groupBy({
//       by: ['created_at'],
//       where: {
//         created_at: {
//           gte: startOfWeek,
//           lte: now,
//         },
//       },
//       _sum: {
//         total_quantity: true,
//       },
//       orderBy: {
//         created_at: 'asc',
//       },
//     });

//     const formattedOrders = orders.map((order) => {
//       const date = new Date(order.created_at);

//       const formatDate = new Intl.DateTimeFormat('en-GB', {
//         weekday: 'short',
//         day: '2-digit',
//         month: 'short',
//       }).format(date);

//       return {
//         format_date: formatDate,
//         plain_date: order.created_at.toISOString(),
//         total_quantity: order._sum.total_quantity,
//       };
//     });

//     return {
//       success: true,
//       message: 'Orders fetched successfully',
//       data: formattedOrders,
//     };
//   }

//   async findOneOrder(id: string) {
//     const order = await this.prisma.order.findUnique({
//       where: {
//         id,
//       },
//       select: {
//         id: true,
//         total_quantity: true,
//         created_at: true,
//         status: true,
//         order_items: {
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
//         },
//         user: {
//           select: {
//             id: true,
//             name: true,
//           },
//         },
//       },
//     });

//     if (!order) throw new NotFoundException('Order not found');
//     return {
//       success: true,
//       message: 'Order fetched successfully',
//       order: order,
//     };
//   }

//   async approveOne(id: string) {
//     if (!id) throw new BadRequestException('Order ID is required');
//     const order = await this.prisma.order.update({
//       where: {
//         id,
//       },
//       data: {
//         status: OrderStatus.APPROVED,
//       },
//       select: {
//         id: true,
//         total_quantity: true,
//         created_at: true,
//         status: true,
//         order_items: {
//           select: {
//             id: true,
//             quantity: true,
//             product: {
//               select: {
//                 user_id: true,
//                 id: true,
//                 name: true,
//               },
//             },
//           },
//         },
//         user: {
//           select: {
//             id: true,
//             name: true,
//           },
//         },
//       },
//     });
//     if (!order) throw new NotFoundException('Order not found');

//     const managerNotificationPayload: NotificationPayload = {
//       text: `Your today’s order is approved.`,
//       receiver_id: order.user.id,
//       sender_id: order.order_items[0].product.user_id,
//       entity_id: order.id,
//     };

//     const adminNotificationPayload: NotificationPayload = {
//       text: `Your approved ${order.user.name} order`,
//       receiver_id: order.user.id,
//       sender_id: order.order_items[0].product.user_id,
//       entity_id: order.id,
//     };

//     await Promise.all([
//       this._sendNotification(adminNotificationPayload),
//       this._sendNotification(managerNotificationPayload),
//     ]);

//     return {
//       success: true,
//       message: 'Order approved successfully',
//       order: order,
//     };
//   }
// }

//=======================================================================================================================================

// import {
//   BadGatewayException,
//   BadRequestException,
//   Injectable,
//   NotFoundException,
//   UnauthorizedException,
// } from '@nestjs/common';
// import { PrismaService } from 'src/prisma/prisma.service';
// import { QueryOrderDto } from './dto/query-order.dto';
// import { OrderStatus, Prisma, StockStatus, status } from '@prisma/client';
// import { CreateOrderDto } from './dto/create-order.dto';
// import { NotificationPayload } from 'src/common/repository/notification/notification.repository';
// import { NotificationService } from '../notification/notification.service';
// import { NotificationRepository } from '../../../common/repository/notification/notification.repository';
// import { StringHelper } from 'src/common/helper/string.helper';

// @Injectable()
// export class OrderService {
//   constructor(
//     private prisma: PrismaService,
//     private notificationService: NotificationService, // Firebase-based push
//   ) { }

//   /**
//    * Firebase Push + DB Save (replaces WebSocket logic)
//    */
//   private async _sendNotification(payload: NotificationPayload) {
//     // Save in DB
//     await NotificationRepository.createNotification(payload);

//     // Push to device (Firebase)
//     await this.notificationService.sendNotification({
//       ...payload,
//       title: 'New Notification',
//       body: payload.text,
//       type: payload.type || 'order',
//     });
//   }

//   private startOfDay(date: Date) {
//     const d = new Date(date);
//     d.setHours(0, 0, 0, 0);
//     return d;
//   }

//   private endOfDay(date: Date) {
//     const d = new Date(date);
//     d.setHours(23, 59, 59, 999);
//     return d;
//   }

//   private startOfWeek(date: Date) {
//     return new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);
//   }

//   private startOfMonth(date: Date) {
//     return new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000);
//   }

//   // ------------------------------------------------------------
//   // 💥 CREATE ORDER (with Firebase push notifications)
//   // ------------------------------------------------------------
//   async create(createOrderDto: CreateOrderDto, user_id: string) {
//     if (!user_id) throw new UnauthorizedException('User ID is required');

//     const user = await this.prisma.user.findUnique({
//       where: { id: user_id },
//       select: {
//         order_exist: true,
//         status: true,
//         name: true,
//       },
//     });

//     if (user.order_exist || user.status === status.LOCKED) {
//       throw new BadRequestException(
//         'User not eligible right now to place an order',
//       );
//     }

//     const products = await Promise.all(
//       createOrderDto.products.map(async (p) => {
//         const product = await this.prisma.product.findUnique({
//           where: {
//             id: p.product_id,
//             stock_status: {
//               not: StockStatus.OUT_OF_STOCK,
//             },
//           },
//           select: { price: true, stock: true, user_id: true, name: true },
//         });

//         if (!product) {
//           throw new NotFoundException(
//             `Product not found for ID: ${p.product_id}`,
//           );
//         }

//         if (product.stock < p.quantity) {
//           throw new BadRequestException(
//             `Not enough quantity for product: ${product.name}`,
//           );
//         }

//         return {
//           ...p,
//           price: product.price,
//           user_id: product.user_id,
//         };
//       }),
//     );

//     const total_amount = products.reduce(
//       (acc, { quantity, price }) => acc + quantity * price,
//       0,
//     );

//     const total_quantity = products.reduce(
//       (acc, { quantity }) => acc + quantity,
//       0,
//     );

//     const order = await this.prisma.order.create({
//       data: {
//         user_id,
//         total_amount,
//         total_quantity,
//         order_items: {
//           create: createOrderDto.products.map((p) => ({
//             product_id: p.product_id,
//             quantity: p.quantity,
//             price: products.find((pr) => pr.product_id === p.product_id).price,
//           })),
//         },
//       },
//       select: {
//         id: true,
//         total_amount: true,
//         total_quantity: true,
//         created_at: true,
//         order_items: {
//           select: {
//             id: true,
//             quantity: true,
//             price: true,
//             product: {
//               select: {
//                 user_id: true,
//                 name: true,
//                 price: true,
//               },
//             },
//           },
//         },
//       },
//     });

//     // Update stocks and send low stock notifications
//     await Promise.all(
//       createOrderDto.products.map(async (p) => {
//         const product = await this.prisma.product.update({
//           where: { id: p.product_id },
//           data: {
//             stock: { decrement: p.quantity },
//           },
//         });

//         if (0 < product.stock && product.stock < 50) {
//           await this.prisma.product.update({
//             where: { id: product.id },
//             data: { stock_status: StockStatus.LOW_STOCK },
//           });

//           await this._sendNotification({
//             text: `Your ${product.name} stock is under 50`,
//             receiver_id: product.user_id,
//             sender_id: null,
//             entity_id: product.id,
//           });
//         } else if (product.stock === 0) {
//           await this.prisma.product.update({
//             where: { id: product.id },
//             data: { stock_status: StockStatus.OUT_OF_STOCK },
//           });
//           await this._sendNotification({
//             text: `Your ${product.name} stock is out of stock`,
//             receiver_id: product.user_id,
//             sender_id: null,
//             entity_id: product.id,
//           });
//         }
//       }),
//     );

//     const updatedUser = await this.prisma.user.update({
//       where: { id: user_id },
//       data: {
//         order_exist: true,
//       },
//       select: { id: true, name: true },
//     });

//     const adminNotificationPayload: NotificationPayload = {
//       text: `Received a new order from ${updatedUser.name}`,
//       sender_id: updatedUser.id,
//       receiver_id: order.order_items[0].product.user_id,
//       entity_id: order.id,
//     };

//     const managerNotificationPayload: NotificationPayload = {
//       text: `Your order placed successfully`,
//       receiver_id: updatedUser.id,
//       sender_id: order.order_items[0].product.user_id,
//       entity_id: order.id,
//     };

//     await Promise.all([
//       this._sendNotification(adminNotificationPayload),
//       this._sendNotification(managerNotificationPayload),
//     ]);

//     return { success: true, message: 'Order placed successfully', order };
//   }

//   // ------------------------------------------------------------
//   // 📌 Manager — get own orders
//   // ------------------------------------------------------------
//   async findAllForManager(user_id: string, query?: QueryOrderDto) {
//     if (!user_id) throw new UnauthorizedException('User ID is required');

//     const { period = 'today', search } = query || {};

//     const where: Prisma.OrderWhereInput = { user_id };

//     if (search) {
//       const formattedQuery = StringHelper.formatSearchQuery(search);
//       const numericSearch = Number(search);
//       const isNumeric = !isNaN(numericSearch);

//       where.OR = [
//         { id: { contains: search, mode: 'insensitive' } },
//         {
//           user: {
//             OR: [
//               { name: { search: formattedQuery } },
//               { phone_number: { contains: search, mode: 'insensitive' } },
//             ],
//           },
//         },
//         {
//           order_items: {
//             some: { product: { name: { search: formattedQuery } } },
//           },
//         },
//         ...(isNumeric ? [{ total_quantity: { equals: numericSearch } }] : []),
//       ];
//     } else {
//       const now = new Date();
//       let dateFilter;

//       if (period === 'today')
//         dateFilter = { gte: this.startOfDay(now), lte: this.endOfDay(now) };
//       else if (period === 'week')
//         dateFilter = { gte: this.startOfWeek(now), lte: this.endOfDay(now) };
//       else if (period === 'month')
//         dateFilter = { gte: this.startOfMonth(now), lte: this.endOfDay(now) };
//       else {
//         const parsed = new Date(period);
//         dateFilter = !isNaN(parsed.getTime())
//           ? { gte: this.startOfDay(parsed), lte: this.endOfDay(parsed) }
//           : { gte: this.startOfDay(now), lte: this.endOfDay(now) };
//       }

//       if (dateFilter) {
//         where.created_at = dateFilter;
//       }
//     }

//     const orders = await this.prisma.order.findMany({
//       where,
//       orderBy: { created_at: 'desc' },
//       select: {
//         id: true,
//         total_amount: true,
//         total_quantity: true,
//         created_at: true,
//         order_items: {
//           select: {
//             id: true,
//             quantity: true,
//             price: true,
//             product: { select: { name: true, price: true } },
//           },
//         },
//       },
//     });

//     return {
//       success: true,
//       message: 'Orders fetched successfully',
//       data: orders,
//     };
//   }

//   // ------------------------------------------------------------
//   // 📌 Admin — get all orders
//   // ------------------------------------------------------------
//   async findAllForAdmin(user_id: string, query?: QueryOrderDto) {
//     if (!user_id) throw new UnauthorizedException('User ID is required');

//     const { period = 'today', search } = query || {};
//     const where: Prisma.OrderWhereInput = {};

//     if (search) {
//       const formattedQuery = StringHelper.formatSearchQuery(search);
//       const numericSearch = Number(search);
//       const isNumeric = !isNaN(numericSearch);

//       where.OR = [
//         { id: { contains: search, mode: 'insensitive' } },
//         { user: { name: { search: formattedQuery } } },
//         { user: { phone_number: { contains: search, mode: 'insensitive' } } },
//         {
//           order_items: {
//             some: { product: { name: { search: formattedQuery } } },
//           },
//         },
//         ...(isNumeric ? [{ total_quantity: { equals: numericSearch } }] : []),
//       ];
//     } else {
//       const now = new Date();

//       let dateFilter;

//       if (period === 'today')
//         dateFilter = { gte: this.startOfDay(now), lte: this.endOfDay(now) };
//       else if (period === 'week')
//         dateFilter = { gte: this.startOfWeek(now), lte: this.endOfDay(now) };
//       else if (period === 'month')
//         dateFilter = { gte: this.startOfMonth(now), lte: this.endOfDay(now) };
//       else {
//         const parsed = new Date(period);
//         dateFilter = !isNaN(parsed.getTime())
//           ? { gte: this.startOfDay(parsed), lte: this.endOfDay(parsed) }
//           : { gte: this.startOfDay(now), lte: this.endOfDay(now) };
//       }

//       if (dateFilter) {
//         where.created_at = dateFilter;
//       }
//     }

//     const orders = await this.prisma.order.findMany({
//       where,
//       orderBy: { created_at: 'desc' },
//       select: {
//         id: true,
//         total_quantity: true,
//         created_at: true,
//         status: true,
//         user: { select: { id: true, name: true } },
//       },
//     });

//     if (search) {
//       return {
//         success: true,
//         message: 'Orders fetched successfully',
//         data: { orders, stats: null },
//       };
//     }

//     const total = orders.length;
//     const pending = orders.filter(
//       (o) => o.status === OrderStatus.PENDING,
//     ).length;
//     const delivered = orders.filter(
//       (o) => o.status === OrderStatus.DELIVERED,
//     ).length;

//     const invoiced = await this.prisma.invoice.count({
//       where: {
//         order_id: { in: orders.map((o) => o.id) },
//         status: 'PAID',
//       },
//     });

//     const total_unit_ordered = orders.reduce(
//       (sum, o) => sum + o.total_quantity,
//       0,
//     );

//     return {
//       success: true,
//       message: 'Orders fetched successfully',
//       data: {
//         orders,
//         stats: {
//           total,
//           pending,
//           invoiced,
//           delivered,
//           total_unit_ordered,
//         },
//       },
//     };
//   }

//   // ------------------------------------------------------------
//   // 📊 Last 7 days data (Admin Dashboard)
//   // ------------------------------------------------------------
//   async findLastSevenDaysOrders() {
//     const now = new Date();
//     const startOfWeek = this.startOfWeek(now);

//     const orders = await this.prisma.order.groupBy({
//       by: ['created_at'],
//       where: {
//         created_at: {
//           gte: startOfWeek,
//           lte: now,
//         },
//       },
//       _sum: {
//         total_quantity: true,
//       },
//       orderBy: {
//         created_at: 'asc',
//       },
//     });

//     const formattedOrders = orders.map((order) => {
//       const date = new Date(order.created_at);

//       const formatDate = new Intl.DateTimeFormat('en-GB', {
//         weekday: 'short',
//         day: '2-digit',
//         month: 'short',
//       }).format(date);

//       return {
//         format_date: formatDate,
//         plain_date: order.created_at.toISOString(),
//         total_quantity: order._sum.total_quantity,
//       };
//     });

//     return {
//       success: true,
//       message: 'Orders fetched successfully',
//       data: formattedOrders,
//     };
//   }

//   // ------------------------------------------------------------
//   // 📌 Find One Order
//   // ------------------------------------------------------------
//   async findOneOrder(id: string) {
//     const order = await this.prisma.order.findUnique({
//       where: {
//         id,
//       },
//       select: {
//         id: true,
//         total_quantity: true,
//         created_at: true,
//         status: true,
//         order_items: {
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
//         },
//         user: {
//           select: {
//             id: true,
//             name: true,
//           },
//         },
//       },
//     });

//     if (!order) throw new NotFoundException('Order not found');

//     return {
//       success: true,
//       message: 'Order fetched successfully',
//       order: order,
//     };
//   }

//   // ------------------------------------------------------------
//   // ✔ Approve Order (Admin)
//   // ------------------------------------------------------------
//   async approveOne(id: string) {
//     if (!id) throw new BadRequestException('Order ID is required');

//     const order = await this.prisma.order.update({
//       where: { id },
//       data: { status: OrderStatus.APPROVED },
//       select: {
//         id: true,
//         total_quantity: true,
//         created_at: true,
//         status: true,
//         order_items: {
//           select: {
//             id: true,
//             quantity: true,
//             product: {
//               select: {
//                 user_id: true,
//                 id: true,
//                 name: true,
//               },
//             },
//           },
//         },
//         user: {
//           select: {
//             id: true,
//             name: true,
//           },
//         },
//       },
//     });

//     if (!order) throw new NotFoundException('Order not found');

//     const managerNotificationPayload: NotificationPayload = {
//       text: `Your today’s order is approved.`,
//       receiver_id: order.user.id,
//       sender_id: order.order_items[0].product.user_id,
//       entity_id: order.id,
//     };

//     const adminNotificationPayload: NotificationPayload = {
//       text: `Your approved ${order.user.name} order`,
//       receiver_id: order.user.id,
//       sender_id: order.order_items[0].product.user_id,
//       entity_id: order.id,
//     };

//     await Promise.all([
//       this._sendNotification(adminNotificationPayload),
//       this._sendNotification(managerNotificationPayload),
//     ]);

//     return {
//       success: true,
//       message: 'Order approved successfully',
//       order: order,
//     };
//   }
// }

import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryOrderDto } from './dto/query-order.dto';
import { OrderStatus, Prisma, StockStatus, status } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { NotificationPayload } from 'src/common/repository/notification/notification.repository';
import { NotificationService } from '../notification/notification.service';
import { StringHelper } from 'src/common/helper/string.helper';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService, // Firebase-based push
  ) {}

  /**
   * Firebase Push Only (DB Save handled in NotificationService)
   */
  private async _sendNotification(payload: NotificationPayload) {
    // Only push to device (Firebase) - DB save is handled in NotificationService
    await this.notificationService.sendNotification({
      ...payload,
      title: 'New Notification',
      body: payload.text,
      type: payload.type || 'order',
    });
  }

  private startOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private startOfWeek(date: Date) {
    return new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  private startOfMonth(date: Date) {
    return new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // ------------------------------------------------------------
  // 💥 CREATE ORDER (with Firebase push notifications)
  // ------------------------------------------------------------
  async create(createOrderDto: CreateOrderDto, user_id: string) {
    if (!user_id) throw new UnauthorizedException('User ID is required');

    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
      select: {
        order_exist: true,
        status: true,
        name: true,
      },
    });

    if (user.order_exist || user.status === status.LOCKED) {
      throw new BadRequestException(
        'User not eligible right now to place an order',
      );
    }

    const products = await Promise.all(
      createOrderDto.products.map(async (p) => {
        const product = await this.prisma.product.findUnique({
          where: {
            id: p.product_id,
            stock_status: {
              not: StockStatus.OUT_OF_STOCK,
            },
          },
          select: { price: true, stock: true, user_id: true, name: true },
        });

        if (!product) {
          throw new NotFoundException(
            `Product not found for ID: ${p.product_id}`,
          );
        }

        if (product.stock < p.quantity) {
          throw new BadRequestException(
            `Not enough quantity for product: ${product.name}`,
          );
        }

        return {
          ...p,
          price: product.price,
          user_id: product.user_id,
        };
      }),
    );

    const total_amount = products.reduce(
      (acc, { quantity, price }) => acc + quantity * price,
      0,
    );

    const total_quantity = products.reduce(
      (acc, { quantity }) => acc + quantity,
      0,
    );

    const order = await this.prisma.order.create({
      data: {
        user_id,
        total_amount,
        total_quantity,
        order_items: {
          create: createOrderDto.products.map((p) => ({
            product_id: p.product_id,
            quantity: p.quantity,
            price: products.find((pr) => pr.product_id === p.product_id).price,
          })),
        },
      },
      select: {
        id: true,
        total_amount: true,
        total_quantity: true,
        created_at: true,
        order_items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            product: {
              select: {
                user_id: true,
                name: true,
                price: true,
              },
            },
          },
        },
      },
    });

    // Update stocks and send low stock notifications
    await Promise.all(
      createOrderDto.products.map(async (p) => {
        const product = await this.prisma.product.update({
          where: { id: p.product_id },
          data: {
            stock: { decrement: p.quantity },
          },
        });

        if (0 < product.stock && product.stock < 50) {
          await this.prisma.product.update({
            where: { id: product.id },
            data: { stock_status: StockStatus.LOW_STOCK },
          });

          await this._sendNotification({
            text: `Your ${product.name} stock is under 50`,
            receiver_id: product.user_id,
            sender_id: null,
            entity_id: product.id,
          });
        } else if (product.stock === 0) {
          await this.prisma.product.update({
            where: { id: product.id },
            data: { stock_status: StockStatus.OUT_OF_STOCK },
          });
          await this._sendNotification({
            text: `Your ${product.name} stock is out of stock`,
            receiver_id: product.user_id,
            sender_id: null,
            entity_id: product.id,
          });
        }
      }),
    );

    const updatedUser = await this.prisma.user.update({
      where: { id: user_id },
      data: {
        order_exist: true,
      },
      select: { id: true, name: true },
    });

    const adminNotificationPayload: NotificationPayload = {
      text: `Received a new order from ${updatedUser.name}`,
      sender_id: updatedUser.id,
      receiver_id: order.order_items[0].product.user_id,
      entity_id: order.id,
    };

    const managerNotificationPayload: NotificationPayload = {
      text: `Your order placed successfully`,
      receiver_id: updatedUser.id,
      sender_id: order.order_items[0].product.user_id,
      entity_id: order.id,
    };

    await Promise.all([
      this._sendNotification(adminNotificationPayload),
      this._sendNotification(managerNotificationPayload),
    ]);

    return { success: true, message: 'Order placed successfully', order };
  }

  // ------------------------------------------------------------
  // 📌 Manager — get own orders
  // ------------------------------------------------------------
  async findAllForManager(user_id: string, query?: QueryOrderDto) {
    if (!user_id) throw new UnauthorizedException('User ID is required');

    const { period = 'today', search } = query || {};

    const where: Prisma.OrderWhereInput = { user_id };

    if (search) {
      const formattedQuery = StringHelper.formatSearchQuery(search);
      const numericSearch = Number(search);
      const isNumeric = !isNaN(numericSearch);

      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { name: { search: formattedQuery } },
              { phone_number: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        {
          order_items: {
            some: { product: { name: { search: formattedQuery } } },
          },
        },
        ...(isNumeric ? [{ total_quantity: { equals: numericSearch } }] : []),
      ];
    } else {
      const now = new Date();
      let dateFilter;

      if (period === 'today')
        dateFilter = { gte: this.startOfDay(now), lte: this.endOfDay(now) };
      else if (period === 'week')
        dateFilter = { gte: this.startOfWeek(now), lte: this.endOfDay(now) };
      else if (period === 'month')
        dateFilter = { gte: this.startOfMonth(now), lte: this.endOfDay(now) };
      else {
        const parsed = new Date(period);
        dateFilter = !isNaN(parsed.getTime())
          ? { gte: this.startOfDay(parsed), lte: this.endOfDay(parsed) }
          : { gte: this.startOfDay(now), lte: this.endOfDay(now) };
      }

      if (dateFilter) {
        where.created_at = dateFilter;
      }
    }

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        total_amount: true,
        total_quantity: true,
        created_at: true,
        order_items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            product: { select: { name: true, image: true } },
          },
        },
      },
    });

    return {
      success: true,
      message: 'Orders fetched successfully',
      data: orders.map((p) => {
        return {
          ...p,
          order_items: p.order_items.map((o) => {
            return {
              ...o,
              product: o.product?.name,
              product_image: o.product?.image
                ? SojebStorage.url(
                    appConfig().storageUrl.product + '/' + o.product.image,
                  )
                : null,
            };
          }),
        };
      }),
    };
  }

  // ------------------------------------------------------------
  // 📌 Admin — get all orders
  // ------------------------------------------------------------
  async findAllForAdmin(user_id: string, query?: QueryOrderDto) {
    if (!user_id) throw new UnauthorizedException('User ID is required');

    const { period = 'today', search } = query || {};
    const where: Prisma.OrderWhereInput = {};

    if (search) {
      const formattedQuery = StringHelper.formatSearchQuery(search);
      const numericSearch = Number(search);
      const isNumeric = !isNaN(numericSearch);

      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { user: { name: { search: formattedQuery } } },
        { user: { phone_number: { contains: search, mode: 'insensitive' } } },
        {
          order_items: {
            some: { product: { name: { search: formattedQuery } } },
          },
        },
        ...(isNumeric ? [{ total_quantity: { equals: numericSearch } }] : []),
      ];
    } else {
      const now = new Date();

      let dateFilter;

      if (period === 'today')
        dateFilter = { gte: this.startOfDay(now), lte: this.endOfDay(now) };
      else if (period === 'week')
        dateFilter = { gte: this.startOfWeek(now), lte: this.endOfDay(now) };
      else if (period === 'month')
        dateFilter = { gte: this.startOfMonth(now), lte: this.endOfDay(now) };
      else {
        const parsed = new Date(period);
        dateFilter = !isNaN(parsed.getTime())
          ? { gte: this.startOfDay(parsed), lte: this.endOfDay(parsed) }
          : { gte: this.startOfDay(now), lte: this.endOfDay(now) };
      }

      if (dateFilter) {
        where.created_at = dateFilter;
      }
    }

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        total_quantity: true,
        created_at: true,
        status: true,
        user: { select: { id: true, name: true } },
      },
    });

    if (search) {
      return {
        success: true,
        message: 'Orders fetched successfully',
        data: { orders, stats: null },
      };
    }

    const total = orders.length;
    const pending = orders.filter(
      (o) => o.status === OrderStatus.PENDING,
    ).length;
    const delivered = orders.filter(
      (o) => o.status === OrderStatus.DELIVERED,
    ).length;

    const invoiced = await this.prisma.invoice.count({
      where: {
        order_id: { in: orders.map((o) => o.id) },
        status: 'PAID',
      },
    });

    const total_unit_ordered = orders.reduce(
      (sum, o) => sum + o.total_quantity,
      0,
    );

    return {
      success: true,
      message: 'Orders fetched successfully',
      data: {
        orders,
        stats: {
          total,
          pending,
          invoiced,
          delivered,
          total_unit_ordered,
        },
      },
    };
  }

  // ------------------------------------------------------------
  // 📊 Last 7 days data (Admin Dashboard)
  // ------------------------------------------------------------
  async findLastSevenDaysOrders() {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 6); // last 7 days including today

    const orders = await this.prisma.$queryRaw<
      { date: Date; total_quantity: number }[]
    >`
  SELECT 
    DATE(created_at) as date,
    SUM(total_quantity) as total_quantity
  FROM "orders"
  WHERE created_at BETWEEN ${sevenDaysAgo} AND ${now}
  GROUP BY DATE(created_at)
  ORDER BY DATE(created_at) ASC
`;

    const formattedOrders = orders.map((order) => {
      const date = new Date(order.date);

      const formatDate = new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      }).format(date);

      return {
        format_date: formatDate, // Sun, Mon etc
        plain_date: date.toISOString(),
        total_quantity: Number(order.total_quantity),
      };
    });

    return {
      success: true,
      message: 'Orders fetched successfully',
      data: formattedOrders,
    };
  }

  // ------------------------------------------------------------
  // 📌 Find One Order
  // ------------------------------------------------------------
  async findOneOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        total_quantity: true,
        created_at: true,
        status: true,
        order_items: {
          select: {
            id: true,
            quantity: true,
            product: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    return {
      success: true,
      message: 'Order fetched successfully',
      order: {
        ...order,
        order_items: order.order_items.map((item) => ({
          ...item,
          product: {
            ...item.product,
            image: item?.product?.image
              ? SojebStorage.url(
                  `${appConfig().storageUrl.product}/${item.product.image}`,
                )
              : null,
          },
        })),
      },
    };
  }

  // ------------------------------------------------------------
  // ✔ Approve Order (Admin)
  // ------------------------------------------------------------
  async approveOne(id: string) {
    if (!id) throw new BadRequestException('Order ID is required');

    const order = await this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.APPROVED },
      select: {
        id: true,
        total_quantity: true,
        created_at: true,
        status: true,
        order_items: {
          select: {
            id: true,
            quantity: true,
            product: {
              select: {
                user_id: true,
                id: true,
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    const managerNotificationPayload: NotificationPayload = {
      text: `Your today's order is approved.`,
      receiver_id: order.user.id,
      sender_id: order.order_items[0].product.user_id,
      entity_id: order.id,
    };

    const adminNotificationPayload: NotificationPayload = {
      text: `You approved ${order.user.name} order`,
      receiver_id: order.order_items[0].product.user_id,
      sender_id: order.user.id,
      entity_id: order.id,
    };

    await Promise.all([
      this._sendNotification(adminNotificationPayload),
      this._sendNotification(managerNotificationPayload),
    ]);

    return {
      success: true,
      message: 'Order approved successfully',
      order: order,
    };
  }
}
