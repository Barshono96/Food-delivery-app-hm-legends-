import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface NotificationPayload {
  sender_id?: string;
  receiver_id: string;
  text: string;
  type?:
    | 'message'
    | 'comment'
    | 'review'
    | 'invoice'
    | 'order'
    | 'product'
    | 'reminder'
    | 'payment_transaction'
    | 'package'
    | 'blog';
  entity_id: string;
}

export class NotificationRepository {
  /**
   * Create a notification
   * @param sender_id - The ID of the user who fired the event
   * @param receiver_id - The ID of the user to notify
   * @param text - The text of the notification
   * @param type - The type of the notification
   * @param entity_id - The ID of the entity related to the notification
   * @returns The created notification
   */
  static async createNotification({
    sender_id,
    receiver_id,
    text,
    type,
    entity_id,
  }: NotificationPayload) {
    const notificationEventData: {
      type?: string;
      text?: string;
      title?: string;
      data?: any;
      actions?: any;
    } = {};
    if (type) {
      notificationEventData['type'] = type;
    }
    if (text) {
      notificationEventData['text'] = text;
    }
    const notificationEvent = await prisma.notificationEvent.create({
      data: {
        ...notificationEventData,
      },
    });

    const notificationData = {};
    if (sender_id) {
      notificationData['sender_id'] = sender_id;
    }
    if (receiver_id) {
      notificationData['receiver_id'] = receiver_id;
    }
    if (entity_id) {
      notificationData['entity_id'] = entity_id;
    }

    const notification = await prisma.notification.create({
      data: {
        notification_event_id: notificationEvent.id,
        ...notificationData,
      },
    });

    return notification;
  }

  static async findAll(where_condition: any, limit?: number, cursor?: string) {
    const take = limit ? limit : 10;

    const notifications = await prisma.notification.findMany({
      where: {
        ...where_condition,
      },
      select: {
        id: true,
        entity_id: true,
        created_at: true,
        read_at: true,
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        notification_event: {
          select: {
            id: true,
            type: true,
            text: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: take,
      ...(cursor && {
        skip: 1,
        cursor: {
          id: cursor,
        },
      }),
    });

    return notifications;
  }

  static async findOne(where: any) {
    return await prisma.notification.findFirst({
      where: where,
    });
  }

  static async readNotification(id: string) {
    return await prisma.notification.update({
      where: {
        id: id,
      },
      data: {
        read_at: new Date(),
      },
    });
  }

  static async readAll(user_id: string) {
    return await prisma.notification.updateMany({
      where: {
        receiver_id: user_id,
        read_at: null,
      },
      data: {
        read_at: new Date(),
      },
    });
  }
}
