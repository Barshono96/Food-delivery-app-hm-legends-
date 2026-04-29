import { IsNumber, IsOptional, IsString } from 'class-validator';

export class FindAllNotificationDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsString()
  period?: string;
}
