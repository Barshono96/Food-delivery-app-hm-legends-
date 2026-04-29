import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CronService implements OnModuleInit {
  constructor(
    @InjectQueue('cron') private readonly cronQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.cronQueue.obliterate({ force: true });
    console.log('[CronService] ✅ Queue obliterated successfully!');
    await this.scheduleResetExistOrder();
  }

  async scheduleResetExistOrder() {
    const isDevelopment = this.configService.get('NODE_ENV') === 'development';
    const pattern = isDevelopment
      ? '*/10 * * * * *' // every 10 seconds for development
      : '0 0 * * *'; // every day at 12 AM

    await this.cronQueue.add(
      'reset-exist-order',
      {},
      {
        repeat: {
          pattern,
        },
        jobId: 'reset-exist-order', // unique job id to avoid duplicates
      },
    );
  }
}
