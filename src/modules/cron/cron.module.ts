import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CronService } from './cron.service';
import { CronProcessor } from './cron.processor';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'cron',
    }),
    PrismaModule,
    ConfigModule,
  ],
  providers: [CronService, CronProcessor],
  exports: [CronService],
})
export class CronModule {}
