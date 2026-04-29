import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  DeliveryStatus,
  InvoiceStatus,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { QueryInvoiceDto } from './dto/query-invoice.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationPayload } from 'src/common/repository/notification/notification.repository';
import { MailService } from 'src/mail/mail.service';
import appConfig from 'src/config/app.config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as ejs from 'ejs';
import * as fs from 'fs';
import * as path from 'path';
import { StringHelper } from 'src/common/helper/string.helper';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';

@Injectable()
export class InvoiceService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService, // ✔ Firebase service
    private mailService: MailService,
    @InjectQueue('invoice-queue') private invoiceQueue: Queue,
  ) {}

  // ---------------------------------------------------------
  // FIREBASE NOTIFICATION SENDER
  // ---------------------------------------------------------
  private async _sendNotification(payload: NotificationPayload) {
    await this.notificationService.sendNotification({
      receiver_id: payload.receiver_id,
      sender_id: payload.sender_id,
      entity_id: payload.entity_id,
      type: 'invoice',
      title: 'Invoice Update',
      text: payload.text || 'Invoice notification',
      data: payload,
    });
  }

  private startOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private startOfWeek(date: Date) {
    return new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  private startOfMonth(date: Date) {
    return new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  private generateSku(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return `INV-${result}`;
  }

  private async generateUniqueSku(): Promise<string> {
    let sku = '';
    let exists = true;
    while (exists) {
      sku = this.generateSku();
      const found = await this.prisma.invoice.findUnique({ where: { sku } });
      exists = !!found;
    }
    return sku;
  }

  // ---------------------------------------------------------
  // CREATE INVOICE
  // ---------------------------------------------------------
  async create(createInvoiceDto: CreateInvoiceDto, user_id: string) {
    if (!user_id) throw new UnauthorizedException();

    const order = await this.prisma.order.findUnique({
      where: { id: createInvoiceDto.order_id },
      select: {
        id: true,
        status: true,
        user_id: true,
        invoice: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });

    if (!order || order.status !== OrderStatus.APPROVED)
      throw new BadRequestException('Order not found or not approved');

    if (order.invoice) {
      return {
        success: true,
        message: 'Invoice already exists',
        data: order.invoice,
      };
    }
    const sku = await this.generateUniqueSku();

    const invoice = await this.prisma.invoice.create({
      data: {
        order_id: createInvoiceDto.order_id,
        receiver_id: order.user_id,
        creator_id: user_id,
        sku,
      },
    });

    // enqueue pdf generation so invoice PDF is created after invoice creation
    try {
      await this.invoiceQueue.add('generate-invoice-pdf', {
        invoiceId: invoice.id,
        email: order.user?.email || null,
      });
    } catch (err) {
      // don't break invoice creation flow if queueing fails
    }

    const payload: NotificationPayload = {
      text: `Your invoice ${sku} is ready.`,
      receiver_id: order.user_id,
      sender_id: user_id,
      entity_id: invoice.id,
    };

    await this._sendNotification(payload);

    return {
      success: true,
      message: 'Invoice created successfully',
      data: invoice,
    };
  }

  // ---------------------------------------------------------
  // FIND ALL INVOICES
  // ---------------------------------------------------------
  async findAllInvoice(query: QueryInvoiceDto, user_id?: string) {
    const { period = 'today', search } = query || {};
    const where: Prisma.InvoiceWhereInput = {};

    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
      select: { type: true },
    });

    if (user?.type !== 'admin') {
      where.receiver_id = user_id;
    }

    if (search) {
      const formattedQuery = StringHelper.formatSearchQuery(search);
      where.OR = [
        { sku: { search: formattedQuery } },
        { order_id: { search: formattedQuery } },
        {
          receiver: {
            is: {
              OR: [
                { first_name: { search: formattedQuery } },
                { last_name: { search: formattedQuery } },
                { name: { search: formattedQuery } },
              ],
            },
          },
        },
      ];
    } else {
      const now = new Date();
      let dateFilter;

      if (period === 'today') {
        dateFilter = { gte: this.startOfDay(now), lte: this.endOfDay(now) };
      } else if (period === 'week') {
        dateFilter = { gte: this.startOfWeek(now), lte: this.endOfDay(now) };
      } else if (period === 'month') {
        dateFilter = { gte: this.startOfMonth(now), lte: this.endOfDay(now) };
      } else {
        const parsed = new Date(period);
        dateFilter = !isNaN(parsed.getTime())
          ? { gte: this.startOfDay(parsed), lte: this.endOfDay(parsed) }
          : { gte: this.startOfDay(now), lte: this.endOfDay(now) };
      }

      where.created_at = dateFilter;
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        order_id: true,
        status: true,
        created_at: true,
        url: true,
        order: {
          select: {
            total_quantity: true,
          },
        },
        receiver: {
          select: {
            address: true,
            phone_number: true,
            name: true,
          },
        },
      },
    });

    const pending_invoice = invoices.filter(
      (i) => i.status === InvoiceStatus.PENDING,
    ).length;
    const paid_invoice = invoices.filter(
      (i) => i.status === InvoiceStatus.PAID,
    ).length;

    return {
      success: true,
      message: 'Invoices fetched successfully',
      data: {
        invoices: invoices.map(({ status, order, receiver, ...i }) => ({
          ...i,
          branch_name: receiver.name,
          total_quantity: order.total_quantity,
          url: i.url
            ? SojebStorage.url(`${appConfig().storageUrl.invoice}/${i.url}`)
            : null,
        })),
        stats: {
          pending_invoice,
          paid_invoice,
          total_invoice: invoices.length,
        },
      },
    };
  }

  // ---------------------------------------------------------
  // SINGLE INVOICE DETAILS
  // ---------------------------------------------------------
  async findOneDetails(id: string, id_type: 'order' | 'invoice' = 'order') {
    const where = id_type === 'order' ? { order_id: id } : { id };

    const invoice = await this.prisma.invoice.findUnique({
      where,
      select: {
        id: true,
        order_id: true,
        sku: true,
        status: true,
        created_at: true,
        url: true,
        creator: {
          select: {
            name: true,
            address: true,
            phone_number: true,
          },
        },
        receiver: {
          select: {
            name: true,
            address: true,
            phone_number: true,
          },
        },
        order: {
          select: {
            id: true,
            status: true,
            total_amount: true,
            total_quantity: true,
            order_items: {
              select: {
                quantity: true,
                price: true,
                product: {
                  select: {
                    name: true,
                    price: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    return {
      success: true,
      message: 'Invoice found successfully',
      data: {
        ...invoice,
        url: invoice.url
          ? SojebStorage.url(`${appConfig().storageUrl.invoice}/${invoice.url}`)
          : null,
      },
    };
  }

  // ---------------------------------------------------------
  // MARK INVOICE AS PAID
  // ---------------------------------------------------------
  async makePaid(id: string, user_id: string) {
    if (!id) throw new BadRequestException('Invoice ID is required');

    const delivery = await this.prisma.delivery.findFirst({
      where: { order: { invoice: { id } } },
      select: { id: true, status: true, delivered_at: true },
    });

    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.status !== DeliveryStatus.COMPLETED)
      throw new BadRequestException('Delivery not completed yet');

    const invoice = await this.prisma.invoice.update({
      where: { id, receiver_id: user_id },
      data: {
        status: InvoiceStatus.PAID,
        order: { update: { status: OrderStatus.COMPLETED } },
      },
      select: {
        id: true,
        sku: true,
        order_id: true,
        status: true,
        creator_id: true,
      },
    });

    const payload: NotificationPayload = {
      text: `Invoice ${invoice.sku} has been paid.`,
      receiver_id: invoice.creator_id,
      sender_id: user_id,
      entity_id: invoice.id,
    };

    await this._sendNotification(payload);

    return {
      success: true,
      message: 'Invoice paid successfully',
      data: {
        status: invoice.status,
        invoice_id: invoice.id,
        sku: invoice.sku,
        order_id: invoice.order_id,
      },
    };
  }

  // ---------------------------------------------------------
  // SEND INVOICE PDF VIA EMAIL
  // ---------------------------------------------------------
  async sendInvoice(id: string, email: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        creator: true,
        receiver: true,
        order: {
          include: {
            order_items: {
              include: { product: true },
            },
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    // if PDF already exists, send immediately
    if (invoice.url) {
      const templatePath = path.resolve(
        process.cwd(),
        'src',
        'mail',
        'templates',
        'invoice.ejs',
      );
      const template = fs.readFileSync(templatePath, 'utf-8');

      const data = {
        invoiceNo: invoice.sku,
        date: new Date(invoice.created_at).toLocaleDateString(),
        invoiceFrom: {
          name: invoice.creator?.name,
          address: invoice.creator?.address,
          phone: invoice.creator?.phone_number,
        },
        shipTo: {
          name: invoice.receiver?.name,
          address: invoice.receiver?.address,
          phone: invoice.receiver?.phone_number,
        },
        items: invoice.order.order_items.map((item) => ({
          name: item.product?.name,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity,
        })),
        subtotal: invoice.order.total_amount,
      };

      const html = ejs.render(template, data);
      const pdfFullUrl = SojebStorage.url(
        `${appConfig().storageUrl.invoice}/${invoice.url}`,
      );

      const emailHtml =
        html +
        `<div style="padding:20px;max-width:500px;margin:auto;text-align:center;font-family:'Segoe UI',Tahoma,Verdana,sans-serif;">
  <h3 style="color:#1d1f2c;margin-bottom:8px;">Thank you for your purchase!</h3>
  <p style="color:#555;font-size:14px;margin-top:0;margin-bottom:16px;">
    You can download your invoice by clicking the button below:
  </p>
  <a href="${pdfFullUrl}"
     style="display:inline-block;background-color:#1d4ed8;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:500;transition:background-color 0.2s;">
    📄 Download Invoice
  </a>
  <p style="color:#777;font-size:12px;margin-top:18px;">
    If the button doesn’t work, copy and paste this link into your browser:<br>
    <a href="${pdfFullUrl}" style="color:#1d4ed8;text-decoration:underline;">${pdfFullUrl}</a>
  </p>
</div>
`;

      await this.mailService.sendInvoiceEmail(
        email,
        `Invoice ${invoice.sku}`,
        emailHtml,
        pdfFullUrl,
      );

      return { success: true, message: 'Invoice sent successfully' };
    }

    // otherwise enqueue generation (processor will send email when done)
    await this.invoiceQueue.add('generate-invoice-pdf', {
      invoiceId: id,
      email: email,
    });

    return {
      success: true,
      message: 'Invoice is being processed and will be sent shortly.',
    };
  }
}
