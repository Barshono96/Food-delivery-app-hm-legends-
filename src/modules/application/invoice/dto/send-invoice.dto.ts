import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendInvoiceDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
