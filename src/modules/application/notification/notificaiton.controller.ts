// import {
//   Controller,
//   Get,
//   Param,
//   UseGuards,
//   Req,
//   Query,
//   Put,
// } from '@nestjs/common';
// import { NotificationService } from './notification.service';
// import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
// import { RolesGuard } from '../../../common/guard/role/roles.guard';
// import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
// import { Request } from 'express';
// import { FindAllNotificationDto } from './dto/find-all-notification.dto';

// @ApiBearerAuth()
// @ApiTags('Notification')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Controller('notification')
// export class NotificationController {
//   constructor(private readonly notificationService: NotificationService) {}

//   @ApiOperation({ summary: 'Get all notifications' })
//   @Get()
//   async findAll(@Req() req: Request, @Query() query: FindAllNotificationDto) {
//     const user_id = req.user.userId;

//     const notification = await this.notificationService.findAll(user_id, query);

//     return notification;
//   }

//   @ApiOperation({ summary: 'Mark all notifications as read' })
//   @Put('read-all')
//   async readAll(@Req() req: Request) {
//     const user_id = req.user.userId;
//     const notification = await this.notificationService.readAll(user_id);

//     return notification;
//   }

//   @ApiOperation({ summary: 'Mark notification as read' })
//   @Put(':id/read')
//   async readNotification(@Req() req: Request, @Param('id') id: string) {
//     const user_id = req.user.userId;
//     const notification = await this.notificationService.readNotification(
//       id,
//       user_id,
//     );

//     return notification;
//   }
// }


//========================================================================================================================================

// import {
//   Controller,
//   Get,
//   Param,
//   UseGuards,
//   Req,
//   Query,
//   Put,
//   Post,
//   Body
// } from '@nestjs/common';
// import { NotificationService } from './notification.service';
// import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
// import { RolesGuard } from '../../../common/guard/role/roles.guard';
// import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
// import { Request } from 'express';
// import { FindAllNotificationDto } from './dto/find-all-notification.dto';

// @ApiBearerAuth()
// @ApiTags('Notification')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Controller('notification')
// export class NotificationController {
//   constructor(private readonly notificationService: NotificationService) { }

//  // NEW API — Create + Send Push Notification (Firebase)

//   @ApiOperation({ summary: 'Send notification to user (Firebase Push)' })
//   @Post('send')
//   async sendNotification(@Body() body: any) {
//     return this.notificationService.sendNotification(body);
//   }


//   // Get all notifications (same as before)

//   @ApiOperation({ summary: 'Get all notifications' })
//   @Get()
//   async findAll(@Req() req: Request, @Query() query: FindAllNotificationDto) {
//     const user_id = req.user.userId;
//     return this.notificationService.findAll(user_id, query);
//   }


//    // Mark all as read (same as before)
//   @ApiOperation({ summary: 'Mark all notifications as read' })
//   @Put('read-all')
//   async readAll(@Req() req: Request) {
//     const user_id = req.user.userId;
//     return this.notificationService.readAll(user_id);
//   }


//    // Mark one notification as read (same as before)
//   @ApiOperation({ summary: 'Mark notification as read' })
//   @Put(':id/read')
//   async readNotification(@Req() req: Request, @Param('id') id: string) {
//     const user_id = req.user.userId;
//     return this.notificationService.readNotification(id, user_id);
//   }




//   //for testing purpose.......................
//   @Post('test')
//   async test(@Body('token') token: string) {
//     return this.notificationService.sendTestNotification(token);
//   }

// }



import {
  Controller,
  Get,
  Param,
  UseGuards,
  Req,
  Query,
  Put,
  Post,
  Body
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { FindAllNotificationDto } from './dto/find-all-notification.dto';

@ApiBearerAuth()
@ApiTags('Notification')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) { }

  // NEW API — Create + Send Push Notification (Firebase)
  @ApiOperation({ summary: 'Send notification to user (Firebase Push)' })
  @Post('send')
  async sendNotification(@Body() body: any) {
    return this.notificationService.sendNotification(body);
  }

  // Get all notifications (same as before)
  @ApiOperation({ summary: 'Get all notifications' })
  @Get()
  async findAll(@Req() req: Request, @Query() query: FindAllNotificationDto) {
    const user_id = req.user.userId;
    return this.notificationService.findAll(user_id, query);
  }

  // Mark all as read (same as before)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @Put('read-all')
  async readAll(@Req() req: Request) {
    const user_id = req.user.userId;
    return this.notificationService.readAll(user_id);
  }

  // Mark one notification as read (same as before)
  @ApiOperation({ summary: 'Mark notification as read' })
  @Put(':id/read')
  async readNotification(@Req() req: Request, @Param('id') id: string) {
    const user_id = req.user.userId;
    return this.notificationService.readNotification(id, user_id);
  }

  //for testing purpose.......................
  @Post('test')
  async test(@Body('token') token: string) {
    return this.notificationService.sendTestNotification(token);
  }
}