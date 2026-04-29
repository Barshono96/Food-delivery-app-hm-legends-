import { PartialType } from '@nestjs/swagger';
import { CreateDeliveryDto } from './create-delivery.dto';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateDeliveryDto extends PartialType(CreateDeliveryDto) {}

export enum CheckType {
  RECEIVED = 'RECEIVED',
  DELIVERED = 'DELIVERED',
}

export class MarkReceivedOrDeliveredDto {
  @IsNotEmpty({ message: 'check_type is required' })
  @IsEnum(CheckType, {
    message: 'check_type must be either RECEIVED or DELIVERED',
  })
  check_type: CheckType;

  @IsOptional()
  @IsString()
  note?: string;
}
