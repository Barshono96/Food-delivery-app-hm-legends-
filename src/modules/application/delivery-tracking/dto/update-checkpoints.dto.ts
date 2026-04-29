import { IsNumber, IsOptional } from 'class-validator';

export class UpdateCheckpointsDto {
  @IsOptional() @IsNumber() checkpoint1_lat?: number;
  @IsOptional() @IsNumber() checkpoint1_lon?: number;

  @IsOptional() @IsNumber() checkpoint2_lat?: number;
  @IsOptional() @IsNumber() checkpoint2_lon?: number;

  @IsOptional() @IsNumber() checkpoint3_lat?: number;
  @IsOptional() @IsNumber() checkpoint3_lon?: number;

  @IsOptional() @IsNumber() destination_lat?: number;
  @IsOptional() @IsNumber() destination_lon?: number;
}
