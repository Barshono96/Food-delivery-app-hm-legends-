import { IsOptional, IsString } from 'class-validator';

export class QueryOrderDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  period?: string;
}
