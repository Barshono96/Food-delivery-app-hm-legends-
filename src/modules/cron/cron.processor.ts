import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { status } from '@prisma/client';

@Processor('cron')
export class CronProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'reset-exist-order':
        await this.prisma.user.updateMany({
          where: {
            status: status.ACTIVE,
            order_exist: true,
          },
          data: {
            order_exist: false,
          },
        });
        console.log(`[CornProcessor] update order_exist flag`);
        break;
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }
}
