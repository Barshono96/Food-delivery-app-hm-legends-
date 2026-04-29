import { Global, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
// import { NotificationGateway } from './notification.gateway';
import { NotificationController } from './notificaiton.controller';
import { FirebaseService } from './firebase.service';

@Global()
@Module({
  controllers: [NotificationController],
  // providers: [NotificationGateway, NotificationService],
  providers: [NotificationService, FirebaseService],
  // exports: [NotificationGateway],
  exports: [NotificationService],
})
export class NotificationModule { }
