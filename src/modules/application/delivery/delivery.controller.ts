import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Query,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { MarkReceivedOrDeliveredDto } from './dto/update-delivery.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { FindAllQueryDeliveryDto } from './dto/query-delivery.dto';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('delivery')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post()
  @Roles(Role.ADMIN)
  assignToDriver(
    @Req() req: Request,
    @Body() createDeliveryDto: CreateDeliveryDto,
  ) {
    const { userId: user_id } = req.user;
    return this.deliveryService.assignToDriver(createDeliveryDto, user_id);
  }

  @Get()
  @Roles(Role.ADMIN, Role.DRIVER)
  findAllDeliveries(
    @Req() req: Request,
    @Query() findAllQueryDeliveryDto: FindAllQueryDeliveryDto,
  ) {
    return this.deliveryService.findAllDeliveries(
      findAllQueryDeliveryDto,
      req.user.userId,
    );
  }

  @Get(':id')
  @Roles(Role.DRIVER)
  findOneDelivery(@Req() req: Request, @Param('id') id: string) {
    const { userId: user_id } = req.user;
    return this.deliveryService.findOneDelivery(id, user_id);
  }

  @Patch(':id')
  @Roles(Role.DRIVER)
  @UseInterceptors(FileInterceptor('signature'))
  markReceivedOrDelivered(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() markReceivedOrDeliveredDto: MarkReceivedOrDeliveredDto,
    @UploadedFile() signature: Express.Multer.File,
  ) {
    const { userId: user_id } = req.user;
    return this.deliveryService.markReceivedOrDelivered(
      id,
      markReceivedOrDeliveredDto,
      user_id,
      signature,
    );
  }
}
