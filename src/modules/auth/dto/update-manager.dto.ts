import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateManagerDto {
  @ApiPropertyOptional({ example: 'John Manager', description: 'Manager name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: 'House 12, Road 5, Banani, Dhaka',
    description: 'Manager address',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({
    example: 'active',
    description: 'Manager account status (active/inactive/suspended)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;
}
