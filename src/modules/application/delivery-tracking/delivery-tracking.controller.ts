import { Body, Controller, Get, Param, Patch, Post, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { DeliveryTrackingService } from './delivery-tracking.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateCheckpointsDto } from './dto/update-checkpoints.dto';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { Request } from 'express';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('delivery-tracking')
export class DeliveryTrackingController {
  constructor(private readonly trackingService: DeliveryTrackingService) { }

  @Roles(Role.DRIVER)
  @Post('update-location')
  async updateLocation(@Body() dto: UpdateLocationDto) {
    return this.trackingService.updateDriverLocation(dto);
  }

  @Roles(Role.DRIVER)
  @Patch('update-checkpoints/:deliveryId')
  async updateCheckpoints(
    @Param('deliveryId') deliveryId: string,
    @Body() dto: UpdateCheckpointsDto,
  ) {
    return this.trackingService.updateCheckpoints(deliveryId, dto);
  }

  @Roles(Role.MANAGER)
  @Get('get-tracking-info/:deliveryId')
  async getTrackingInfo(@Param('deliveryId') deliveryId: string) {
    return this.trackingService.getTrackingInfo(deliveryId);
  }

  @Roles(Role.DRIVER)
  @Post('stop-delivery/:deliveryId')
  async stopDelivery(
    @Param('deliveryId') deliveryId: string,
    @Req() req: Request,
  ) {
    const { userId: driverId } = req.user;
    return this.trackingService.stopDelivery(deliveryId, driverId);
  }

}
