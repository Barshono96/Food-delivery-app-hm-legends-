import { IsNotEmpty, IsString } from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  order_id: string;
}
