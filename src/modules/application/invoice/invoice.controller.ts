import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Request } from 'express';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { QueryInvoiceDto } from './dto/query-invoice.dto';
import { SendInvoiceDto } from './dto/send-invoice.dto';

@Controller('invoice')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Req() req: Request, @Body() createInvoiceDto: CreateInvoiceDto) {
    const { userId: user_id } = req.user;
    return this.invoiceService.create(createInvoiceDto, user_id);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER)
  findAllInvoice(@Req() req: Request, @Query() query: QueryInvoiceDto) {
    const { userId: user_id } = req.user;
    if (!user_id) throw new UnauthorizedException();
    return this.invoiceService.findAllInvoice(query, user_id);
  }

  @Get('order/:id')
  @Roles(Role.ADMIN, Role.MANAGER)
  findOneDetails(@Req() req: Request, @Param('id') id: string) {
    return this.invoiceService.findOneDetails(id, 'order');
  }

  @Post(':id/send')
  @Roles(Role.ADMIN)
  sendInvoice(@Param('id') id: string, @Body() sendInvoiceDto: SendInvoiceDto) {
    return this.invoiceService.sendInvoice(id, sendInvoiceDto.email);
  }

  @Patch(':id/pay')
  @Roles(Role.MANAGER)
  makePaid(@Param('id') id: string, @Req() req: Request) {
    const { userId: user_id } = req.user;
    return this.invoiceService.makePaid(id, user_id);
  }
}
