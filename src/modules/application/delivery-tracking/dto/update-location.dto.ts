import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UpdateLocationDto {
  @IsString()
  @IsNotEmpty()
  deliveryId: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lon: number;
}
