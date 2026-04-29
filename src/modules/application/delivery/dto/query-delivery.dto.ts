import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class FindAllQueryDeliveryDto {
  @IsOptional()
  @IsString()
  cursor: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && !isNaN(+value) ? +value : value,
  )
  @IsNumber()
  limit: number;
}
