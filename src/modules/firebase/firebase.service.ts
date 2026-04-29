import { Inject, Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);

  constructor(@Inject('FIREBASE_ADMIN') private firebaseApp: admin.app.App) { }

  getAuth(): admin.auth.Auth {
    return this.firebaseApp.auth();
  }

  async pushToDevice(
    token: string,
    title: string,
    body: string,
    payload: any = {},
  ) {
    const message: admin.messaging.Message = {
      token,
      notification: { title, body },
      data: this._normalizePayload(payload),
      android: { priority: 'high' },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            alert: { title, body },
          },
        },
      },
    };

    try {
      const res = await this.firebaseApp.messaging().send(message);
      this.logger.log(`📨 Push notification sent: ${res}`);
      return res;
    } catch (err) {
      this.logger.error('❌ Firebase push error', err);
      throw err;
    }
  }

  private _normalizePayload(payload: any) {
    const normalized = {} as Record<string, string>;
    for (const key in payload) {
      normalized[key] = String(payload[key]);
    }
    return normalized;
  }
}
