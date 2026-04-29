import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @ApiProperty()
  first_name?: string;

  @IsOptional()
  @ApiProperty()
  last_name?: string;

  @IsOptional()
  @ApiProperty({
    description: 'City',
    example: 'Lagos',
  })
  city?: string;

  @IsOptional()
  @ApiProperty()
  occupation?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Phone number',
    example: '+91 9876543210',
  })
  phone_number?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Address',
    example: 'New York, USA',
  })
  address?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Date of birth',
    example: '14/11/2001',
  })
  date_of_birth?: string;
}
