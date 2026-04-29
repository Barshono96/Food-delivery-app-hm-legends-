import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { BullModule } from '@nestjs/bullmq';
import { InvoiceProcessor } from './invoice.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'invoice-queue',
    }),
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoiceProcessor],
})
export class InvoiceModule {}
