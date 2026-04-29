import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  IsInt,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @MinLength(3, { message: 'Product name must be at least 3 characters long' })
  name: string;

  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseFloat(value) : value,
  ) // Convert string to number
  @IsNumber()
  @Min(0, { message: 'Price must be a positive number' })
  price: number;

  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  ) // Convert string to number
  @IsNumber()
  @IsInt({ message: 'Stock must be an integer' })
  @Min(0, { message: 'Stock must be a non-negative integer' })
  stock: number;
}
