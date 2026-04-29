import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import * as puppeteer from 'puppeteer';
import * as ejs from 'ejs';
import * as fs from 'fs';
import * as path from 'path';
import appConfig from 'src/config/app.config';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage'; // Import SojebStorage

@Processor('invoice-queue')
export class InvoiceProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoiceProcessor.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {
    super();
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(
      `Processing job ${job.id} of type ${job.name} with data ${job.data}...`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: any) {
    this.logger.log(`Job ${job.id} with name ${job.name} completed`);
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing job ${job.id} with name ${job.name}`);
    try {
      switch (job.name) {
        case 'generate-invoice-pdf':
          this.logger.log('Generating invoice PDF');
          const { invoiceId, email } = job.data;

          let invoice = await this.prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
              creator: true,
              receiver: true,
              order: {
                include: {
                  order_items: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
            },
          });

          if (!invoice) {
            this.logger.error(`Invoice with ID ${invoiceId} not found.`);
            return;
          }

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
              name: invoice.creator.name,
              address: invoice.creator.address,
              phone: invoice.creator.phone_number,
            },
            shipTo: {
              name: invoice.receiver.name,
              address: invoice.receiver.address,
              phone: invoice.receiver.phone_number,
            },
            items: invoice.order.order_items.map((item) => ({
              name: item.product.name,
              price: item.price,
              quantity: item.quantity,
              total: item.price * item.quantity,
            })),
            subtotal: invoice.order.total_amount,
          };

          const html = ejs.render(template, data);
          let pdfRelativePath = invoice.url;

          if (!pdfRelativePath) {
            this.logger.log('PDF not found, generating new one.');
            const browser = await puppeteer.launch({
              args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
            const page = await browser.newPage();
            await page.setContent(html);
            const pdfBuffer = await page.pdf({ format: 'A4' });
            await browser.close();

            const pdfFileName = `${invoice.sku}.pdf`;
            pdfRelativePath =
              appConfig().storageUrl.invoice + `/${pdfFileName}`;
            await SojebStorage.put(pdfRelativePath, pdfBuffer);
            invoice = await this.prisma.invoice.update({
              where: { id: invoice.id },
              data: { url: pdfFileName },
              include: {
                creator: true,
                receiver: true,
                order: {
                  include: {
                    order_items: {
                      include: {
                        product: true,
                      },
                    },
                  },
                },
              },
            });
          }

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

          if (email) {
            await this.mailService.sendInvoiceEmail(
              email,
              `Invoice ${invoice.sku}`,
              emailHtml,
              pdfFullUrl,
            );
          } else {
            this.logger.log(
              `No email provided for invoice ${invoice.sku}; skipping send.`,
            );
          }
          break;
        default:
          this.logger.log('Unknown job name');
          return;
      }
    } catch (error) {
      this.logger.error(
        `Error processing job ${job.id} with name ${job.name}`,
        error,
      );
      throw error;
    }
  }
}
