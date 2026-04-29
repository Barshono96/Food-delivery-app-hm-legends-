import {
  IsArray,
  ArrayNotEmpty,
  IsNotEmpty,
  IsString,
  Matches,
} from 'class-validator';

export class CreateDeliveryDto {
  @IsNotEmpty()
  @Matches(/^c[a-z0-9]{24}$/, { message: 'order_id must be a valid CUID' })
  order_id: string;

  @IsNotEmpty()
  @Matches(/^c[a-z0-9]{24}$/, { message: 'driver_id must be a valid CUID' })
  driver_id: string;
}
