import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { Request } from 'express';
import { QueryOrderDto } from './dto/query-order.dto';

@Controller('order')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @Roles(Role.MANAGER)
  create(@Req() req: Request, @Body() createOrderDto: CreateOrderDto) {
    const { userId: user_id } = req.user;
    return this.orderService.create(createOrderDto, user_id);
  }

  @Get()
  @Roles(Role.MANAGER)
  findAllForManager(@Req() req: Request, @Query() query: QueryOrderDto) {
    console.log(req.user);
    const { userId: user_id } = req.user;
    return this.orderService.findAllForManager(user_id, query);
  }

  @Get('admin')
  @Roles(Role.ADMIN)
  findAllForAdmin(@Req() req: Request, @Query() query: QueryOrderDto) {
    const { userId: user_id } = req.user;
    return this.orderService.findAllForAdmin(user_id, query);
  }

  @Get('last-seven-days/admin')
  @Roles(Role.ADMIN)
  findLastSevenDaysOrders() {
    return this.orderService.findLastSevenDaysOrders();
  }

  @Get(':id/admin')
  @Roles(Role.ADMIN)
  findOneOrder(@Param('id') id: string) {
    return this.orderService.findOneOrder(id);
  }

  @Patch(':id/approve/admin')
  @Roles(Role.ADMIN)
  approveOne(@Param('id') id: string) {
    return this.orderService.approveOne(id);
  }
}
