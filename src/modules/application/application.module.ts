import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { ContactModule } from './contact/contact.module';
import { FaqModule } from './faq/faq.module';
import { ProductModule } from './product/product.module';
import { OrderModule } from './order/order.module';
import { ManageBranch } from './manage_branch/entities/manage_branch.entity';
import { InvoiceModule } from './invoice/invoice.module';
import { DeliveryModule } from './delivery/delivery.module';
import { DeliveryTrackingModule } from './delivery-tracking/delivery-tracking.module';

@Module({
  imports: [
    NotificationModule,
    ContactModule,
    FaqModule,
    ProductModule,
    OrderModule,
    ManageBranch,
    InvoiceModule,
    DeliveryModule,
    DeliveryTrackingModule,
  ],
})
export class ApplicationModule {}
