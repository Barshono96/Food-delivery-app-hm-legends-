import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { findAllQueryDto } from './dto/product-queries.dto';
import { Prisma, status, StockStatus } from '@prisma/client';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { StringHelper } from 'src/common/helper/string.helper';
import { Role } from 'src/common/guard/role/role.enum';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}
  async create(
    createProductDto: CreateProductDto,
    user_id: string,
    image: Express.Multer.File,
  ) {
    if (!user_id) throw new UnauthorizedException();

    let imageName: string | null = null;
    let imagePath: string | null = null;
    if (image) {
      const ext = image.originalname.split('.').pop();
      if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        throw new BadRequestException('Invalid image type');
      }
      imageName = `${Date.now()}-${StringHelper.randomString(8)}.${ext}`;
      imagePath = appConfig().storageUrl.product + '/' + imageName;
      try {
        await SojebStorage.put(imagePath, image.buffer);
      } catch (error) {
        throw new Error('Image upload failed');
      }
    }

    try {
      const product = await this.prisma.product.create({
        data: {
          ...createProductDto,
          stock_status:
            createProductDto.stock >= 50
              ? StockStatus.IN_STOCK
              : createProductDto.stock > 0
                ? StockStatus.LOW_STOCK
                : StockStatus.OUT_OF_STOCK,
          user_id,
          image: imageName,
        },
        select: {
          id: true,
          name: true,
          image: true,
          stock: true,
          price: true,
          stock_status: true,
          created_at: true,
        },
      });
      return {
        success: true,
        message: 'Product created successfully',
        data: {
          ...product,
          image: product.image
            ? SojebStorage.url(
                `${appConfig().storageUrl.product}/${product.image}`,
              )
            : null,
        },
      };
    } catch (error) {
      if (imagePath) {
        await SojebStorage.delete(imagePath);
      }
      throw error;
    }
  }

  async findAll(user_id: string, query?: findAllQueryDto) {
    if (!user_id) throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
      select: {
        order_exist: true,
        status: true,
        type: true,
      },
    });
    if (user.order_exist || user.status == status.LOCKED)
      throw new UnauthorizedException(
        'User not eligible right now to make orders',
      );
    const { search, cursor, limit } = query;
    const take = limit ? parseInt(limit) : 10;

    const where: Prisma.ProductWhereInput = {};

    if (user.type === 'admin') {
      where.stock_status = query.status;
    } else {
      where.stock_status = { not: StockStatus.OUT_OF_STOCK };
      where.deleted_at = null;
    }

    if (search) {
      const formattedQuery = StringHelper.formatSearchQuery(search);
      const numericSearch = Number(search);
      const isNumeric = !isNaN(numericSearch);

      where.OR = [
        { name: { search: formattedQuery, mode: 'insensitive' } },
        { sku: { search: formattedQuery, mode: 'insensitive' } },
      ];

      if (isNumeric) {
        where.OR.push({ stock: numericSearch });
        where.OR.push({ price: numericSearch });
      }
    }

    const products = await this.prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        image: true,
        stock: true,
        price: true,
        stock_status: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    let next_cursor: string | null = null;
    if (products.length > take) {
      const nextItem = products.pop();
      next_cursor = nextItem.id.toString();
    }

    return {
      success: true,
      message: 'Products fetched successfully',
      data: products.map((p) => ({
        ...p,
        image: p.image
          ? SojebStorage.url(appConfig().storageUrl.product + '/' + p.image)
          : null,
      })),
      next_cursor,
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        image: true,
        stock: true,
        price: true,
        stock_status: true,
        created_at: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return {
      success: true,
      message: 'Product fetched successfully',
      data: {
        ...product,
        image: product?.image
          ? SojebStorage.url(
              appConfig().storageUrl.product + '/' + product.image,
            )
          : null, // Construct full URL for response
      },
    };
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    user_id: string,
    image: Express.Multer.File,
  ) {
    if (!user_id) throw new UnauthorizedException();
    const exist = await this.prisma.product.findFirst({
      where: {
        id,
      },
      select: {
        id: true,
        image: true,
      },
    });

    let imageName: string | null = exist.image; // Changed to newImagePath
    if (image) {
      const ext = image.originalname.split('.').pop();
      if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        throw new BadRequestException('Invalid image type');
      }
      imageName = `${Date.now()}-${StringHelper.randomString(8)}.${ext}`;
      const newImagePath = appConfig().storageUrl.product + '/' + imageName;
      try {
        await SojebStorage.put(newImagePath, image.buffer);
        if (exist.image) {
          // Delete old image using its stored path (which is now relative)
          await SojebStorage.delete(
            appConfig().storageUrl.product + '/' + exist.image,
          );
        }
      } catch (error) {
        throw new Error('Image upload failed');
      }
    }

    const updated = await this.prisma.product.update({
      where: { id: exist.id },
      data: {
        ...updateProductDto,
        ...(updateProductDto.stock && {
          stock_status:
            updateProductDto.stock >= 50
              ? StockStatus.IN_STOCK
              : updateProductDto.stock > 0
                ? StockStatus.LOW_STOCK
                : StockStatus.OUT_OF_STOCK,
        }),
        image: imageName, // Save relative path
      },
      select: {
        id: true,
        name: true,
        image: true,
        stock: true,
        price: true,
        stock_status: true,
        created_at: true,
      },
    });
    return {
      success: true,
      message: 'Product updated successfully',
      data: {
        ...updated,
        image: updated.image
          ? SojebStorage.url(
              `${appConfig().storageUrl.product}/${updated.image}`,
            )
          : null, // Construct full URL for response
      },
    };
  }

  async remove(id: string, user_id: string) {
    if (!user_id) throw new UnauthorizedException();
    const exist = await this.prisma.product.findFirst({
      where: { id },
      select: {
        id: true,
        image: true,
      },
    });
    if (!exist) throw new NotFoundException('Product notfound');

    if (exist.image) {
      // Delete image using its stored path (which is now relative)
      await SojebStorage.delete(
        await SojebStorage.delete(
          `${appConfig().storageUrl.product}/${exist.image}`,
        ),
      );
    }

    const product = await this.prisma.product.delete({
      where: {
        id: exist.id,
        user_id: user_id,
      },
      select: {
        id: true,
        name: true,
        image: true,
        stock: true,
        price: true,
        stock_status: true,
        created_at: true,
      },
    });
    return {
      success: true,
      message: 'Product deleted successfully',
      data: {
        ...product,
        image: product.image ? SojebStorage.url(product.image) : null, // Construct full URL for response
      },
    };
  }
}
