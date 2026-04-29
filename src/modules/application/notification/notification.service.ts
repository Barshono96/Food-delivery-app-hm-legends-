// import { BadRequestException, Injectable, Logger } from '@nestjs/common';
// import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
// import appConfig from '../../../config/app.config';
// import { NotificationRepository } from '../../../common/repository/notification/notification.repository';
// import { Prisma } from '@prisma/client';
// import { FindAllNotificationDto } from './dto/find-all-notification.dto';

// @Injectable()
// export class NotificationService {
//   private readonly logger = new Logger(NotificationService.name);

//   private _addAvatarUrls(notifications: any[]) {
//     for (const notification of notifications) {
//       if (notification.sender?.avatar) {
//         notification.sender.avatar_url = SojebStorage.url(
//           appConfig().storageUrl.avatar + notification.sender.avatar,
//         );
//       }
//       if (notification.receiver?.avatar) {
//         notification.receiver.avatar_url = SojebStorage.url(
//           appConfig().storageUrl.avatar + notification.receiver.avatar,
//         );
//       }
//     }
//   }

//   async findAll(user_id: string, query: FindAllNotificationDto) {
//     const { limit = 10, cursor, period = 'today' } = query;

//     const now = new Date();

//     const startOfDay = (date: Date) => new Date(date.setHours(0, 0, 0, 0));
//     const endOfDay = (date: Date) => new Date(date.setHours(23, 59, 59, 999));

//     const startOfWeek = (date: Date) => {
//       const d = new Date(date);
//       const day = d.getDay();
//       const diff = d.getDate() - day + (day === 0 ? -6 : 1);
//       return startOfDay(new Date(d.setDate(diff)));
//     };

//     const startOfMonth = (date: Date) =>
//       new Date(date.getFullYear(), date.getMonth(), 1);

//     let dateFilter: { gte: Date; lte: Date } | undefined;

//     // if (!search) {
//     if (period === 'today') {
//       dateFilter = { gte: startOfDay(now), lte: endOfDay(now) };
//     } else if (period === 'week') {
//       dateFilter = { gte: startOfWeek(now), lte: endOfDay(now) };
//     } else if (period === 'month') {
//       dateFilter = { gte: startOfMonth(now), lte: endOfDay(now) };
//     } else {
//       const parsedDate = new Date(period);
//       if (!isNaN(parsedDate.getTime())) {
//         dateFilter = {
//           gte: startOfDay(parsedDate),
//           lte: endOfDay(parsedDate),
//         };
//       } else {
//         dateFilter = { gte: startOfDay(now), lte: endOfDay(now) };
//       }
//     }
//     const where: Prisma.OrderWhereInput = {
//       ...(dateFilter && { created_at: dateFilter }),
//     };
//     const notifications = await NotificationRepository.findAll(
//       where,
//       limit,
//       cursor,
//     );

//     this._addAvatarUrls(notifications);

//     const nextCursor =
//       notifications.length === limit ? notifications[limit - 1].id : null;

//     return { success: true, data: notifications, nextCursor };
//   }

//   async readNotification(id: string, user_id: string) {
//     const notification = await NotificationRepository.findOne({
//       id,
//       receiver_id: user_id,
//     });

//     if (!notification) {
//       return { success: false, message: 'Notification not found' };
//     }

//     await NotificationRepository.readNotification(id);

//     return { success: true, message: 'Notification marked as read' };
//   }
//   async readAll(user_id: string) {
//     await NotificationRepository.readAll(user_id);

//     return {
//       success: true,
//       message: 'All notifications marked as read',
//     };
//   }
// }


//====================================================================================================================================

// import { Injectable, Logger } from '@nestjs/common';
// import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
// import appConfig from '../../../config/app.config';
// import { NotificationRepository } from '../../../common/repository/notification/notification.repository';
// import { Prisma } from '@prisma/client';
// import { FindAllNotificationDto } from './dto/find-all-notification.dto';
// import { FirebaseService } from './firebase.service';
// import { PrismaClient } from '@prisma/client';

// const prisma = new PrismaClient();

// @Injectable()
// export class NotificationService {
//   private readonly logger = new Logger(NotificationService.name);

//   constructor(private readonly firebaseService: FirebaseService) { }

//   private _addAvatarUrls(notifications: any[]) {
//     for (const notification of notifications) {
//       if (notification.sender?.avatar) {
//         notification.sender.avatar_url = SojebStorage.url(
//           appConfig().storageUrl.avatar + notification.sender.avatar,
//         );
//       }
//       if (notification.receiver?.avatar) {
//         notification.receiver.avatar_url = SojebStorage.url(
//           appConfig().storageUrl.avatar + notification.receiver.avatar,
//         );
//       }
//     }
//   }


//    // SEND NOTIFICATION + PUSH VIA FIREBASE

//   async sendNotification(data: any) {
//     const { sender_id, receiver_id, text, type, entity_id } = data;

//     // 1️⃣ SAVE notification (your existing process)
//     const notification = await NotificationRepository.createNotification({
//       sender_id,
//       receiver_id,
//       text,
//       type,
//       entity_id,
//     });

//     // 2️⃣ FETCH user with fcm token
//     const user = await prisma.user.findFirst({
//       where: { id: receiver_id },
//       select: {
//         id: true,
//         name: true,
//         fcm_token: true,
//       },
//     });

//     if (!user || !user.fcm_token) {
//       this.logger.warn(
//         `User ${receiver_id} has no FCM token. Push skipped.`
//       );
//       return { success: true, message: "Notification saved but no FCM token" };
//     }

//     // Prepare push payload
//     const payload = {
//       id: notification.id,
//       entity_id,
//       title: type ? `${type.toUpperCase()} Notification` : "New Notification",
//       body: text,
//       type,
//     };

//     // 3️⃣ SEND PUSH NOTIFICATION
//     await this.firebaseService.pushToDevice(
//       user.fcm_token,
//       payload.title,
//       payload.body,
//       payload,
//     );

//     this.logger.log(`FCM Push sent to user ${receiver_id}`);

//     return { success: true, message: "Notification sent" };
//   }

//   /**
//    * GET ALL NOTIFICATIONS
//    */
//   async findAll(user_id: string, query: FindAllNotificationDto) {
//     const { limit = 10, cursor, period = 'today' } = query;

//     const now = new Date();

//     const startOfDay = (d: Date) => new Date(d.setHours(0, 0, 0, 0));
//     const endOfDay = (d: Date) => new Date(d.setHours(23, 59, 59, 999));

//     const startOfWeek = (date: Date) => {
//       return new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);
//     };

//     const startOfMonth = (date: Date) =>
//       new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000);

//     let dateFilter: any;

//     if (period === 'today')
//       dateFilter = { gte: startOfDay(now), lte: endOfDay(now) };
//     else if (period === 'week')
//       dateFilter = { gte: startOfWeek(now), lte: endOfDay(now) };
//     else if (period === 'month')
//       dateFilter = { gte: startOfMonth(now), lte: endOfDay(now) };
//     else {
//       const parsed = new Date(period);
//       dateFilter = !isNaN(parsed.getTime())
//         ? { gte: startOfDay(parsed), lte: endOfDay(parsed) }
//         : { gte: startOfDay(now), lte: endOfDay(now) };
//     }

//     // FIXED: correct prisma type
//     const where: Prisma.NotificationWhereInput = {
//       ...(dateFilter && { created_at: dateFilter }),
//       receiver_id: user_id,
//     };

//     // DB fetch
//     const notifications = await NotificationRepository.findAll(
//       where,
//       limit,
//       cursor,
//     );

//     this._addAvatarUrls(notifications);

//     const nextCursor =
//       notifications.length === limit ? notifications[limit - 1].id : null;

//     return { success: true, data: notifications, nextCursor };
//   }

//   /**
//    * MARK SINGLE NOTIFICATION AS READ
//    */
//   async readNotification(id: string, user_id: string) {
//     const notification = await NotificationRepository.findOne({
//       id,
//       receiver_id: user_id,
//     });

//     if (!notification) {
//       return { success: false, message: 'Notification not found' };
//     }

//     await NotificationRepository.readNotification(id);

//     return { success: true, message: 'Notification marked as read' };
//   }

//   /**
//    * MARK ALL AS READ
//    */
//   async readAll(user_id: string) {
//     await NotificationRepository.readAll(user_id);

//     return {
//       success: true,
//       message: 'All notifications marked as read',
//     };
//   }



//   //for testing..................................................
//   async sendTestNotification(token: string) {
//     const message = {
//       token,
//       notification: {
//         title: "🔥 Firebase Test",
//         body: "Your backend real-time notification is working!",
//       },
//       data: {
//         click_action: "FLUTTER_NOTIFICATION_CLICK",
//         type: "test",
//       },
//     };

//     try {
//       // USE firebaseService, not this.admin ❗
//       const res = await this.firebaseService.pushToDevice(
//         token,
//         message.notification.title,
//         message.notification.body,
//         message.data,
//       );

//       return { success: true, messageId: res };
//     } catch (err) {
//       console.log("Firebase Error:", err);
//       return { success: false, error: err.message };
//     }
//   }


// }



import { Injectable, Logger } from '@nestjs/common';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import appConfig from '../../../config/app.config';
import { NotificationRepository } from '../../../common/repository/notification/notification.repository';
import { Prisma } from '@prisma/client';
import { FindAllNotificationDto } from './dto/find-all-notification.dto';
import { FirebaseService } from './firebase.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly firebaseService: FirebaseService) { }

  private _addAvatarUrls(notifications: any[]) {
    for (const notification of notifications) {
      if (notification.sender?.avatar) {
        notification.sender.avatar_url = SojebStorage.url(
          appConfig().storageUrl.avatar + notification.sender.avatar,
        );
      }
      if (notification.receiver?.avatar) {
        notification.receiver.avatar_url = SojebStorage.url(
          appConfig().storageUrl.avatar + notification.receiver.avatar,
        );
      }
    }
  }

  /**
   * SEND NOTIFICATION + PUSH VIA FIREBASE
   * This method handles both saving to DB and sending push notification
   */
  async sendNotification(data: any) {
    const { sender_id, receiver_id, text, type, entity_id } = data;

    // 1️⃣ SAVE notification
    const notification = await NotificationRepository.createNotification({
      sender_id,
      receiver_id,
      text,
      type,
      entity_id,
    });

    // 2️⃣ FETCH user with fcm token
    const user = await prisma.user.findFirst({
      where: { id: receiver_id },
      select: {
        id: true,
        name: true,
        fcm_token: true,
      },
    });

    if (!user || !user.fcm_token) {
      this.logger.warn(
        `User ${receiver_id} has no FCM token. Push skipped.`
      );
      return { success: true, message: "Notification saved but no FCM token" };
    }

    // Prepare push payload
    const payload = {
      id: notification.id,
      entity_id,
      title: type ? `${type.toUpperCase()} Notification` : "New Notification",
      body: text,
      type,
    };

    // 3️⃣ SEND PUSH NOTIFICATION
    try {
      await this.firebaseService.pushToDevice(
        user.fcm_token,
        payload.title,
        payload.body,
        payload,
      );

      this.logger.log(`FCM Push sent to user ${receiver_id}`);
      return { success: true, message: "Notification sent" };
    } catch (err: any) {
      // Handle Firebase errors
      if (
        err?.errorInfo?.code === 'messaging/registration-token-not-registered' ||
        err?.message?.includes('Requested entity was not found')
      ) {
        // Token is invalid/expired. Clear it from the database
        this.logger.warn(
          `FCM token invalid for user ${receiver_id}. Clearing token from DB.`
        );
        await prisma.user.update({
          where: { id: receiver_id },
          data: { fcm_token: null },
        });

        // Return success since notification was saved, token just couldn't be delivered
        return {
          success: true,
          message: "Notification saved. FCM token was invalid and has been cleared.",
        };
      }

      // Re-throw other Firebase errors
      this.logger.error(`FCM send failed for user ${receiver_id}`, err);
      throw err;
    }
  }

  /**
   * GET ALL NOTIFICATIONS
   */
  async findAll(user_id: string, query: FindAllNotificationDto) {
    const { limit = 10, cursor, period = 'today' } = query;

    const now = new Date();

    const startOfDay = (d: Date) => new Date(d.setHours(0, 0, 0, 0));
    const endOfDay = (d: Date) => new Date(d.setHours(23, 59, 59, 999));

    const startOfWeek = (date: Date) => {
      return new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);
    };

    const startOfMonth = (date: Date) =>
      new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000);

    let dateFilter: any;

    if (period === 'today')
      dateFilter = { gte: startOfDay(now), lte: endOfDay(now) };
    else if (period === 'week')
      dateFilter = { gte: startOfWeek(now), lte: endOfDay(now) };
    else if (period === 'month')
      dateFilter = { gte: startOfMonth(now), lte: endOfDay(now) };
    else {
      const parsed = new Date(period);
      dateFilter = !isNaN(parsed.getTime())
        ? { gte: startOfDay(parsed), lte: endOfDay(parsed) }
        : { gte: startOfDay(now), lte: endOfDay(now) };
    }

    // FIXED: correct prisma type
    const where: Prisma.NotificationWhereInput = {
      ...(dateFilter && { created_at: dateFilter }),
      receiver_id: user_id,
    };

    // DB fetch
    const notifications = await NotificationRepository.findAll(
      where,
      limit,
      cursor,
    );

    this._addAvatarUrls(notifications);

    const nextCursor =
      notifications.length === limit ? notifications[limit - 1].id : null;

    return { success: true, data: notifications, nextCursor };
  }

  /**
   * MARK SINGLE NOTIFICATION AS READ
   */
  async readNotification(id: string, user_id: string) {
    const notification = await NotificationRepository.findOne({
      id,
      receiver_id: user_id,
    });

    if (!notification) {
      return { success: false, message: 'Notification not found' };
    }

    await NotificationRepository.readNotification(id);

    return { success: true, message: 'Notification marked as read' };
  }

  /**
   * MARK ALL AS READ
   */
  async readAll(user_id: string) {
    await NotificationRepository.readAll(user_id);

    return {
      success: true,
      message: 'All notifications marked as read',
    };
  }

  //for testing..................................................
  async sendTestNotification(token: string) {
    const message = {
      token,
      notification: {
        title: "🔥 Firebase Test",
        body: "Your backend real-time notification is working!",
      },
      data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        type: "test",
      },
    };

    try {
      // USE firebaseService, not this.admin ❗
      const res = await this.firebaseService.pushToDevice(
        token,
        message.notification.title,
        message.notification.body,
        message.data,
      );

      return { success: true, messageId: res };
    } catch (err) {
      console.log("Firebase Error:", err);
      return { success: false, error: err.message };
    }
  }
}