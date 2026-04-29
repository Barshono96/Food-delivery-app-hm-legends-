import { StockStatus } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';

export class findAllQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsOptional()
  status?: StockStatus;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
