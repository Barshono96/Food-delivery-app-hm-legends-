import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { CreateManagerDto } from './dto/create-manager.dto';
import { UpdateManagerDto } from './dto/update-manager.dto';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Role } from 'src/common/guard/role/role.enum';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { GoogleLoginDto } from './dto/google-login.dto';
import { AppleLoginDto } from './dto/apple-login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @ApiOperation({ summary: 'Get user details' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    try {
      const user_id = req.user.userId;

      const response = await this.authService.me(user_id);

      return response;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch user details',
      };
    }
  }

  @ApiOperation({ summary: 'Register a user' })
  @Post('register')
  async create(@Body() data: CreateUserDto) {
    try {
      const name = data.name;
      // const first_name = data.first_name;
      // const last_name = data.last_name;
      const email = data.email;
      const password = data.password;
      const type = data.type;

      if (!name) {
        throw new HttpException('Name not provided', HttpStatus.UNAUTHORIZED);
      }
      // if (!first_name) {
      //   throw new HttpException(
      //     'First name not provided',
      //     HttpStatus.UNAUTHORIZED,
      //   );
      // }
      // if (!last_name) {
      //   throw new HttpException(
      //     'Last name not provided',
      //     HttpStatus.UNAUTHORIZED,
      //   );
      // }
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!password) {
        throw new HttpException(
          'Password not provided',
          HttpStatus.UNAUTHORIZED,
        );
      }
      if (!type) {
        throw new HttpException('Type not provided', HttpStatus.UNAUTHORIZED);
      }

      const response = await this.authService.register({
        name: name,
        // first_name: first_name,
        // last_name: last_name,
        email: email,
        password: password,
        type: type,
      });

      return response;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  // login user
  @ApiOperation({ summary: 'Login user' })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: Request, @Res() res: Response) {
    try {
      const user_id = req.user.id;

      const user_email = req.user.email;

      const user_type = req.user.type;

      const fcm_token = req.body.fcm_token;

      const response = await this.authService.login({
        userId: user_id,
        email: user_email,
        type: user_type,
        fcm_token: fcm_token,

      });

      // store to secure cookies
      res.cookie('refresh_token', response.authorization.refresh_token, {
        httpOnly: true,
        secure: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      });

      res.json(response);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Refresh token' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('refresh-token')
  async refreshToken(
    @Req() req: Request,
    @Body() body: { refresh_token: string },
  ) {
    try {
      const user_id = req.user.userId;

      const response = await this.authService.refreshToken(
        user_id,
        body.refresh_token,
      );

      return response;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: Request) {
    try {
      const userId = req.user.userId;
      const response = await this.authService.revokeRefreshToken(userId);
      return response;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Post('apple/signin')
  async appleSignIn(@Body() dto: AppleLoginDto) {
    return this.authService.signInWithApple(dto);
  }


  @Post('google/signin')
  async googleSignIn(@Body() googleLoginDto: GoogleLoginDto) {
    return this.authService.signInWithGoogle(googleLoginDto);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleLogin(): Promise<any> {
    return HttpStatus.OK;
  }

  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  async googleLoginRedirect(@Req() req: Request): Promise<any> {
    return {
      statusCode: HttpStatus.OK,
      data: req.user,
    };
  }

  // update user
  @ApiOperation({ summary: 'Update user' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('update')
  @UseInterceptors(
    FileInterceptor('image', {
      // storage: diskStorage({
      //   destination:
      //     appConfig().storageUrl.rootUrl + appConfig().storageUrl.avatar,
      //   filename: (req, file, cb) => {
      //     const randomName = Array(32)
      //       .fill(null)
      //       .map(() => Math.round(Math.random() * 16).toString(16))
      //       .join('');
      //     return cb(null, `${randomName}${file.originalname}`);
      //   },
      // }),
      storage: memoryStorage(),
    }),
  )
  async updateUser(
    @Req() req: Request,
    @Body() data: UpdateUserDto,
    @UploadedFile() image: Express.Multer.File,
  ) {
    try {
      const user_id = req.user.userId;
      const response = await this.authService.updateUser(user_id, data, image);
      return response;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update user',
      };
    }
  }

  // --------------change password---------

  @ApiOperation({ summary: 'Forgot password' })
  @Post('forgot-password')
  async forgotPassword(@Body() data: { email: string }) {
    try {
      const email = data.email;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      return await this.authService.forgotPassword(email);
    } catch (error) {
      return {
        success: false,
        message: 'Something went wrong',
      };
    }
  }

  // reset password if user forget the password
  @ApiOperation({ summary: 'Reset password' })
  @Post('reset-password')
  async resetPassword(
    @Body() data: { email: string; token: string; password: string },
  ) {
    try {
      const email = data.email;
      const token = data.token;
      const password = data.password;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!token) {
        throw new HttpException('Token not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!password) {
        throw new HttpException(
          'Password not provided',
          HttpStatus.UNAUTHORIZED,
        );
      }
      return await this.authService.resetPassword({
        email: email,
        token: token,
        password: password,
      });
    } catch (error) {
      return {
        success: false,
        message: 'Something went wrong',
      };
    }
  }

  @ApiOperation({ summary: 'Verify reset password token' })
  @Post('verify-reset-token')
  async verifyResetToken(
    @Body() data: { email: string; token: string },
  ) {
    try {
      const { email, token } = data;

      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!token) {
        throw new HttpException('Token not provided', HttpStatus.UNAUTHORIZED);
      }

      return await this.authService.verifyResetToken({ email, token });
    } catch (error) {
      return {
        success: false,
        message: 'Something went wrong',
      };
    }
  }

  // @ApiOperation({ summary: 'Set new password' })
  // @Post('set-new-password')
  // async setNewPassword(
  //   @Body() data: { email: string; token: string; password: string },
  // ) {
  //   try {
  //     const { email, token, password } = data;

  //     if (!email) {
  //       throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
  //     }
  //     if (!token) {
  //       throw new HttpException('Token not provided', HttpStatus.UNAUTHORIZED);
  //     }
  //     if (!password) {
  //       throw new HttpException('Password not provided', HttpStatus.UNAUTHORIZED);
  //     }

  //     return await this.authService.setNewPassword({
  //       email,
  //       token,
  //       password,
  //     });
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: 'Something went wrong',
  //     };
  //   }
  // }



  // verify email to verify the email
  @ApiOperation({ summary: 'Verify email' })
  @Post('verify-email')
  async verifyEmail(@Body() data: VerifyEmailDto) {
    try {
      const email = data.email;
      const token = data.token;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!token) {
        throw new HttpException('Token not provided', HttpStatus.UNAUTHORIZED);
      }
      return await this.authService.verifyEmail({
        email: email,
        token: token,
      });
    } catch (error) {
      return {
        success: false,
        message: 'Failed to verify email',
      };
    }
  }

  // resend verification email to verify the email
  @ApiOperation({ summary: 'Resend verification email' })
  @Post('resend-verification-email')
  async resendVerificationEmail(@Body() data: { email: string }) {
    try {
      const email = data.email;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      return await this.authService.resendVerificationEmail(email);
    } catch (error) {
      return {
        success: false,
        message: 'Failed to resend verification email',
      };
    }
  }

  @ApiOperation({ summary: 'Change password' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Req() req: any,
    @Body() data: { old_password: string; new_password: string },
  ) {
    const user_id =
      req.user?.id || req.user?.userId || req.user?.sub || req.user?.user_id;

    if (!user_id) {
      throw new UnauthorizedException('Invalid token');
    }

    const { old_password, new_password } = data;

    if (!old_password || !new_password) {
      throw new BadRequestException('Old and new password are required');
    }

    return await this.authService.changePassword({
      user_id,
      oldPassword: old_password,
      newPassword: new_password,
    });
  }

  // --------------end change password---------

  // -------change email address------
  @ApiOperation({ summary: 'request email change' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('request-email-change')
  async requestEmailChange(
    @Req() req: Request,
    @Body() data: { email: string },
  ) {
    try {
      const user_id = req.user.userId;
      const email = data.email;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      return await this.authService.requestEmailChange(user_id, email);
    } catch (error) {
      return {
        success: false,
        message: 'Something went wrong',
      };
    }
  }

  @ApiOperation({ summary: 'Change email address' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('change-email')
  async changeEmail(
    @Req() req: Request,
    @Body() data: { email: string; token: string },
  ) {
    try {
      const user_id = req.user.userId;
      const email = data.email;

      const token = data.token;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!token) {
        throw new HttpException('Token not provided', HttpStatus.UNAUTHORIZED);
      }
      return await this.authService.changeEmail({
        user_id: user_id,
        new_email: email,
        token: token,
      });
    } catch (error) {
      return {
        success: false,
        message: 'Something went wrong',
      };
    }
  }
  // -------end change email address------

  // --------- 2FA ---------
  @ApiOperation({ summary: 'Generate 2FA secret' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('generate-2fa-secret')
  async generate2FASecret(@Req() req: Request) {
    try {
      const user_id = req.user.userId;
      return await this.authService.generate2FASecret(user_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Verify 2FA' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('verify-2fa')
  async verify2FA(@Req() req: Request, @Body() data: { token: string }) {
    try {
      const user_id = req.user.userId;
      const token = data.token;
      return await this.authService.verify2FA(user_id, token);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Enable 2FA' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('enable-2fa')
  async enable2FA(@Req() req: Request) {
    try {
      const user_id = req.user.userId;
      return await this.authService.enable2FA(user_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Disable 2FA' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('disable-2fa')
  async disable2FA(@Req() req: Request) {
    try {
      const user_id = req.user.userId;
      return await this.authService.disable2FA(user_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  // --------- end 2FA ---------

  // ----------------- Manager routes -----------------

  @ApiOperation({ summary: 'Create manager user' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('create-manager')
  async createManager(@Body() data: CreateManagerDto) {
    try {
      const { name, email, password, address, status } = data;
      if (!name || !email || !password) {
        throw new HttpException(
          'Required fields missing',
          HttpStatus.BAD_REQUEST,
        );
      }

      const response = await this.authService.createManager({
        name,
        email,
        password,
        address,
        status,
      });
      return response;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Update manager' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('update-manager/:id')
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  async updateManager(
    @Param('id') id: string, // ✅ now using param instead of JWT
    @Body() data: UpdateManagerDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    try {
      const response = await this.authService.updateManager(id, data, image);
      return response;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  //FIADLL MANAGER ROUTES -----------------
  @ApiOperation({ summary: 'Get all managers' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('all-managers')
  async getAllManagers(
    @Query('status') status?: 'ACTIVE' | 'LOCKED',
    @Query('search') search?: string,
  ) {
    try {
      const response = await this.authService.getAllManagers(status, search);
      return response;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Toggle manager status (ACTIVE/LOCKED)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('toggle-status/:id')
  async toggleManagerStatus(@Param('id') id: string) {
    return this.authService.toggleManagerStatus(id);
  }

  //get manager by id
  // @ApiOperation({ summary: 'Get manager by ID (with orders)' })
  // @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN)
  // @Get('manager/:id')
  // async getManagerById(@Param('id') id: string) {
  //   try {
  //     const response = await this.authService.getManagerById(id);
  //     return response;
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

  @ApiOperation({ summary: 'Get manager by ID with orders' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('manager/:id')
  async getManagerById(
    @Param('id') id: string,
    @Query() query: { period?: string },
  ) {
    try {
      const response = await this.authService.getManagerById(id, query);
      return response;
    } catch (error:any) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  @ApiOperation({ summary: 'Get all drivers' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('drivers')
  async getDrivers() {
    const response = await this.authService.getDrivers();
    return response;
  }
  @ApiOperation({ summary: 'Get admin stats' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/stats')
  async getAdminStats() {
    const response = await this.authService.getAdminStats();
    return response;
  }

  // --------- USER APPROVAL ENDPOINTS ---------

  @ApiOperation({ summary: 'Get pending manager/driver approvals' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('pending-approvals')
  async getPendingApprovals(@Query('type') type?: 'manager' | 'driver') {
    try {
      const response = await this.authService.getPendingApprovals(type);
      return response;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Approve or Reject a pending manager/driver' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('update-approval/:userId')
  async updateUserApprovalStatus(
    @Param('userId') userId: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED' },
    @Req() req: Request,
  ) {
    try {
      const adminId = req.user.userId;
      const { status } = body;

      if (!userId) {
        throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!status || (status !== 'APPROVED' && status !== 'REJECTED')) {
        throw new HttpException(
          'Status must be either APPROVED or REJECTED',
          HttpStatus.BAD_REQUEST,
        );
      }

      const response = await this.authService.updateUserApprovalStatus(
        userId,
        adminId,
        status,
      );
      return response;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // --------- END USER APPROVAL ENDPOINTS ---------
}
