import { Module } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from './firebase.service';
import appConfig from 'src/config/app.config';

@Module({
  providers: [
    {
      provide: 'FIREBASE_ADMIN',
      useFactory: () => {
        return admin.initializeApp({
          credential: admin.credential.cert({
            projectId: appConfig().firebase.projectId,
            clientEmail: appConfig().firebase.clientEmail,
            privateKey: appConfig().firebase.privateKey.replace(/\\n/g, '\n'),
          }),
        });
      },
    },
    FirebaseService,
  ],
  exports: ['FIREBASE_ADMIN', FirebaseService],
})
export class FirebaseModule {}
