import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

//internal imports
import appConfig from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from '../../common/repository/user/user.repository';
import { MailService } from '../../mail/mail.service';
import { UcodeRepository } from '../../common/repository/ucode/ucode.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { SojebStorage } from '../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../common/helper/date.helper';
import { StripePayment } from '../../common/lib/Payment/stripe/StripePayment';
import { StringHelper } from '../../common/helper/string.helper';
import {
  DeliveryStatus,
  InvoiceStatus,
  OrderStatus,
  Prisma,
  status,
} from '@prisma/client';
import { FirebaseService } from '../firebase/firebase.service';
import { NotificationService } from '../application/notification/notification.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { AppleLoginDto } from './dto/apple-login.dto';
import { generateDriverId } from 'src/common/utils/driver-id.util';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService,
    private firebaseService: FirebaseService,
    private notificationService: NotificationService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // async signInWithGoogle(googleLoginDto: GoogleLoginDto) {
  //   const { type, token, fcm_token } = googleLoginDto;
  //   if (type !== 'admin' && type != 'manager' && type !== 'driver')
  //     throw new BadRequestException(
  //       'User type is missing or invalid user type',
  //     );
  //   const decodedToken = await this.firebaseService
  //     .getAuth()
  //     .verifyIdToken(token);
  //   const { email, name, uid } = decodedToken;

  //   let user = await this.prisma.user.findUnique({
  //     where: { email },
  //   });

  //   if (!user) {
  //     const parts = name.trim().split(' ');
  //     let firstName = name;
  //     let lastName = '';

  //     if (parts.length > 1) {
  //       lastName = parts.pop()!;
  //       firstName = parts.join(' ');
  //     }

  //     let driverId: string | null = null;

  //     // 🔥 For drivers: generate unique Driver ID
  //     if (type === 'driver') {
  //       let unique = false;
  //       while (!unique) {
  //         const randomId = generateDriverId();

  //         const exists = await this.prisma.user.findFirst({
  //           where: { driver_id: randomId },
  //         });

  //         if (!exists) {
  //           driverId = randomId;
  //           unique = true;
  //         }
  //       }
  //     }

  //     const user = await this.prisma.user.create({
  //       data: {
  //         email,
  //         first_name: firstName,
  //         last_name: lastName,
  //         type,

  //         accounts: {
  //           create: {
  //             provider: 'google',
  //             type: 'social',
  //             provider_account_id: uid,
  //           },
  //         },
  //       },
  //     });
  //   }

  //   return await this.login({
  //     email: user.email,
  //     userId: user.id,
  //     type: user.type,

  //   });
  // }

  async signInWithGoogle(googleLoginDto: GoogleLoginDto) {
    const { type, token, fcm_token } = googleLoginDto;

    if (type !== 'admin' && type != 'manager' && type !== 'driver') {
      throw new BadRequestException(
        'User type is missing or invalid user type',
      );
    }

    const decodedToken = await this.firebaseService
      .getAuth()
      .verifyIdToken(token);

    const { email, name, uid } = decodedToken;

    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      const parts = name.trim().split(' ');
      let firstName = name;
      let lastName = '';

      if (parts.length > 1) {
        lastName = parts.pop()!;
        firstName = parts.join(' ');
      }

      let driverId: string | null = null;

      if (type === 'driver') {
        let unique = false;
        while (!unique) {
          const randomId = generateDriverId();
          const exists = await this.prisma.user.findFirst({
            where: { driver_id: randomId },
          });

          if (!exists) {
            driverId = randomId;
            unique = true;
          }
        }
      }

      user = await this.prisma.user.create({
        data: {
          email,
          first_name: firstName,
          last_name: lastName,
          type,
          driver_id: driverId,
          fcm_token: fcm_token || null,
          accounts: {
            create: {
              provider: 'google',
              type: 'social',
              provider_account_id: uid,
            },
          },
        },
      });

      // Set approval status: PENDING for managers/drivers/admins (require admin approval)
      if (type === 'manager' || type === 'driver' || type === 'admin') {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { approved_by: 'PENDING' },
        });
        // notify admins about new pending approval
        try {
          await this.notifyAdminsNewPendingApproval({
            id: user.id,
            name: (user as any).name || (user as any).first_name || '',
            email: user.email,
            type: user.type,
          });
        } catch (err) {
          // ignore notification errors
        }
      }
    } else if (fcm_token) {
      // 🔥 Update token when the user exists
      await this.prisma.user.update({
        where: { id: user.id },
        data: { fcm_token },
      });
    }

    // 🔥 Check approval status — only APPROVED users can login
    if (user.approved_by !== 'APPROVED') {
      throw new UnauthorizedException('Your account is pending admin approval');
    }

    return this.login({
      email: user.email,
      userId: user.id,
      type: user.type,
      fcm_token, // 🔥 Pass token forward
    });
  }

  // async signInWithApple(dto: AppleLoginDto) {
  //   const { type, token } = dto;

  //   if (type !== 'admin' && type !== 'manager' && type !== 'driver')
  //     throw new BadRequestException('Invalid user type');

  //   // Verify Firebase token (same as Google)
  //   const decoded = await this.firebaseService.getAuth().verifyIdToken(token);

  //   const { email, name, uid } = decoded;

  //   if (!email) throw new BadRequestException('Email not found');

  //   let user = await this.prisma.user.findUnique({ where: { email } });

  //   if (!user) {
  //     // Split name
  //     const parts = (name || "").trim().split(" ");
  //     let firstName = parts[0] || "";
  //     let lastName = parts.slice(1).join(" ") || "";

  //     let driverId: string | null = null;

  //     // 🔥 Generate unique Driver ID for drivers
  //     if (type === 'driver') {
  //       let unique = false;

  //       while (!unique) {
  //         const randomId = generateDriverId();

  //         const exists = await this.prisma.user.findFirst({
  //           where: { driver_id: randomId },
  //         });

  //         if (!exists) {
  //           driverId = randomId;
  //           unique = true;
  //         }
  //       }
  //     }

  //     user = await this.prisma.user.create({
  //       data: {
  //         email,
  //         first_name: firstName,
  //         last_name: lastName,
  //         type,
  //         accounts: {
  //           create: {
  //             provider: 'apple',
  //             type: 'social',
  //             provider_account_id: uid,
  //           },
  //         },
  //       },
  //     });
  //   }

  //   return this.login({
  //     email: user.email,
  //     userId: user.id,
  //     type: user.type,
  //   });
  // }

  async signInWithApple(dto: AppleLoginDto) {
    const { type, token, fcm_token } = dto;

    if (type !== 'admin' && type !== 'manager' && type !== 'driver') {
      throw new BadRequestException('Invalid user type');
    }

    const decoded = await this.firebaseService.getAuth().verifyIdToken(token);

    const { email, name, uid } = decoded;

    if (!email) throw new BadRequestException('Email not found');

    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      const parts = (name || '').trim().split(' ');
      let firstName = parts[0] || '';
      let lastName = parts.slice(1).join(' ') || '';

      let driverId: string | null = null;

      if (type === 'driver') {
        let unique = false;
        while (!unique) {
          const randomId = generateDriverId();
          const exists = await this.prisma.user.findFirst({
            where: { driver_id: randomId },
          });

          if (!exists) {
            driverId = randomId;
            unique = true;
          }
        }
      }

      user = await this.prisma.user.create({
        data: {
          email,
          first_name: firstName,
          last_name: lastName,
          type,
          driver_id: driverId,
          fcm_token: fcm_token || null,
          accounts: {
            create: {
              provider: 'apple',
              type: 'social',
              provider_account_id: uid,
            },
          },
        },
      });

      // Set approval status: PENDING for managers/drivers/admins (require admin approval)
      if (type === 'manager' || type === 'driver' || type === 'admin') {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { approved_by: 'PENDING' },
        });
        // notify admins about new pending approval
        try {
          await this.notifyAdminsNewPendingApproval({
            id: user.id,
            name: (user as any).name || (user as any).first_name || '',
            email: user.email,
            type: user.type,
          });
        } catch (err) {
          // ignore notification errors
        }
      }
    } else if (fcm_token) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { fcm_token },
      });
    }

    // 🔥 Check approval status — only APPROVED users can login
    if (user.approved_by !== 'APPROVED') {
      throw new UnauthorizedException('Your account is pending admin approval');
    }

    return this.login({
      email: user.email,
      userId: user.id,
      type: user.type,
      fcm_token,
    });
  }

  async register({
    name,
    email,
    password,
    type,
  }: {
    name: string;
    email: string;
    password: string;
    type: string;
  }) {
    try {
      // Check if email already exist
      const userEmailExist = await UserRepository.exist({
        field: 'email',
        value: String(email),
      });

      if (userEmailExist) {
        return {
          success: false,
          message: 'Email already exist',
        };
      }

      let driverId: string | null = null;
      // 🔥 Generate unique driver_id only for drivers
      if (type === 'driver') {
        let unique = false;

        while (!unique) {
          const randomId = generateDriverId(); // Dv123456

          const exists = await this.prisma.user.findFirst({
            where: { driver_id: randomId },
          });

          if (!exists) {
            driverId = randomId;
            unique = true;
          }
        }
      }

      const user = await UserRepository.createUser({
        name: name,
        // first_name: first_name,
        // last_name: last_name,
        email: email,
        password: password,
        type: type,
        driver_id: driverId,
      });

      if (user == null && user.success == false) {
        return {
          success: false,
          message: 'Failed to create account',
        };
      }

      // Set approval status: PENDING for managers/drivers/admins (require admin approval)
      if (type === 'manager' || type === 'driver' || type === 'admin') {
        await this.prisma.user.update({
          where: { id: user.data.id },
          data: { approved_by: 'PENDING' },
        });
        // notify admins about new pending approval
        try {
          await this.notifyAdminsNewPendingApproval({
            id: user.data.id,
            name: user.data.name || '',
            email: user.data.email,
            type: type,
          });
        } catch (err) {
          // ignore notification errors
        }
      }

      // create stripe customer account
      const stripeCustomer = await StripePayment.createCustomer({
        user_id: user.data.id,
        email: email,
        name: name,
      });

      if (stripeCustomer) {
        await this.prisma.user.update({
          where: {
            id: user.data.id,
          },
          data: {
            billing_id: stripeCustomer.id,
          },
        });
      }

      return {
        success: true,
        message:
          type === 'manager' || type === 'driver'
            ? 'Account created successfully. Pending admin approval.'
            : 'Account created successfully',
        // data: user.data,
      };

      // ----------------------------------------------------
      // create otp code
      // const token = await UcodeRepository.createToken({
      //   userId: user.data.id,
      //   isOtp: true,
      // });

      // // send otp code to email
      // await this.mailService.sendOtpCodeToEmail({
      //   email: email,
      //   name: name,
      //   otp: token,
      // });

      // return {
      //   success: true,
      //   message: 'We have sent an OTP code to your email',
      // };

      // ----------------------------------------------------

      // Generate verification token
      // const token = await UcodeRepository.createVerificationToken({
      //   userId: user.data.id,
      //   email: email,
      // });

      // Send verification email with token
      // await this.mailService.sendVerificationLink({
      //   email,
      //   name: email,
      //   token: token.token,
      //   type: type,
      // });

      // return {
      //   success: true,
      //   message: 'We have sent a verification link to your email',
      // };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async me(userId: string) {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
        },
        select: {
          id: true,
          name: true,
          occupation: true,
          email: true,
          avatar: true,
          address: true,
          city: true,
          phone_number: true,
          type: true,
          created_at: true,
          date_of_birth: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (user.avatar) {
        user['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + '/' + user.avatar,
        );
      }

      if (user) {
        return {
          success: true,
          data: user,
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateUser(
    userId: string,
    updateUserDto: UpdateUserDto,
    image?: Express.Multer.File,
  ) {
    try {
      const data: any = {};
      if (updateUserDto.name) {
        data.name = updateUserDto.name;
      }
      if (updateUserDto.first_name) {
        data.first_name = updateUserDto.first_name;
      }
      if (updateUserDto.last_name) {
        data.last_name = updateUserDto.last_name;
      }
      if (updateUserDto.phone_number) {
        data.phone_number = updateUserDto.phone_number;
      }
      if (updateUserDto.occupation) {
        data.occupation = updateUserDto.occupation;
      }
      if (updateUserDto.city) {
        data.city = updateUserDto.city;
      }
      if (updateUserDto.address) {
        data.address = updateUserDto.address;
      }
      if (updateUserDto.date_of_birth) {
        data.date_of_birth = DateHelper.format(updateUserDto.date_of_birth);
      }
      if (image) {
        // delete old image from storage
        const oldImage = await this.prisma.user.findFirst({
          where: { id: userId },
          select: { avatar: true },
        });
        if (oldImage.avatar) {
          await SojebStorage.delete(
            appConfig().storageUrl.avatar + '/' + oldImage.avatar,
          );
        }

        // upload file
        const fileName = `${StringHelper.randomString()}${image.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.avatar + '/' + fileName,
          image.buffer,
        );

        data.avatar = fileName;
      }
      const user = await UserRepository.getUserDetails(userId);
      if (user) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            ...data,
          },
        });

        return {
          success: true,
          message: 'User updated successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async validateUser(
    email: string,
    pass: string,
    token?: string,
  ): Promise<any> {
    const _password = pass;
    const user = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });

    if (user) {
      // 🔥 Check approval status — only APPROVED users can login
      if (user.approved_by !== 'APPROVED') {
        throw new UnauthorizedException(
          'Your account is pending admin approval',
        );
      }

      const _isValidPassword = await UserRepository.validatePassword({
        email: email,
        password: _password,
      });
      if (_isValidPassword) {
        const { password, ...result } = user;
        if (user.is_two_factor_enabled) {
          if (token) {
            const isValid = await UserRepository.verify2FA(user.id, token);
            if (!isValid) {
              throw new UnauthorizedException('Invalid token');
              // return {
              //   success: false,
              //   message: 'Invalid token',
              // };
            }
          } else {
            throw new UnauthorizedException('Token is required');
            // return {
            //   success: false,
            //   message: 'Token is required',
            // };
          }
        }
        return result;
      } else {
        throw new UnauthorizedException('Password not matched');
        // return {
        //   success: false,
        //   message: 'Password not matched',
        // };
      }
    } else {
      throw new UnauthorizedException('Email not found');
      // return {
      //   success: false,
      //   message: 'Email not found',
      // };
    }
  }

  async login({ email, userId, type, fcm_token }) {
    try {
      const payload = { email: email, id: userId, type: type };

      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

      const user = await UserRepository.getUserDetails(userId, type);

      if (fcm_token) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { fcm_token },
        });
      }
      // store refreshToken
      await this.redis.set(
        `refresh_token:${user.id}`,
        refreshToken,
        'EX',
        60 * 60 * 24 * 7, // 7 days in seconds
      );

      return {
        success: true,
        message: 'Logged in successfully',
        authorization: {
          type: 'bearer',
          access_token: accessToken,
          refresh_token: refreshToken,
        },
        type: user.type,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async refreshToken(user_id: string, refreshToken: string) {
    try {
      const storedToken = await this.redis.get(`refresh_token:${user_id}`);

      if (!storedToken || storedToken != refreshToken) {
        return {
          success: false,
          message: 'Refresh token is required',
        };
      }

      if (!user_id) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const userDetails = await UserRepository.getUserDetails(user_id);
      if (!userDetails) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const payload = { email: userDetails.email, sub: userDetails.id };
      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });

      return {
        success: true,
        authorization: {
          type: 'bearer',
          access_token: accessToken,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async revokeRefreshToken(user_id: string) {
    try {
      const storedToken = await this.redis.get(`refresh_token:${user_id}`);
      if (!storedToken) {
        return {
          success: false,
          message: 'Refresh token not found',
        };
      }

      await this.redis.del(`refresh_token:${user_id}`);

      return {
        success: true,
        message: 'Refresh token revoked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async forgotPassword(email) {
    try {
      const user = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const token = await UcodeRepository.createToken({
          userId: user.id,
          isOtp: true,
        });

        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: user.name,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent an OTP code to your email',
        };
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async resetPassword({ email, token, password }) {
    try {
      const user = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const existToken = await UcodeRepository.validateToken({
          email: email,
          token: token,
        });

        if (existToken) {
          await UserRepository.changePassword({
            email: email,
            password: password,
          });

          // delete otp code
          await UcodeRepository.deleteToken({
            email: email,
            token: token,
          });

          return {
            success: true,
            message: 'Password updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async verifyResetToken({ email, token }) {
    try {
      // Check if the user exists
      const user = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (!user) {
        return {
          success: false,
          message: 'Email not found',
        };
      }

      // Validate the token
      const isTokenValid = await UcodeRepository.validateToken({
        email: email,
        token: token,
      });

      if (!isTokenValid) {
        return {
          success: false,
          message: 'Invalid token',
        };
      }

      return {
        success: true,
        message: 'Token is valid',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // async setNewPassword({ email, token, password }) {
  //   try {
  //     // First validate the token (you can also call verifyResetToken here if needed)
  //     const tokenValidation = await this.verifyResetToken({ email, token });

  //     if (!tokenValidation.success) {
  //       return tokenValidation; // return the error if token is invalid
  //     }

  //     // Proceed with password update if the token is valid
  //     await UserRepository.changePassword({
  //       email: email,
  //       password: password,
  //     });

  //     // Delete OTP code after the password is successfully updated
  //     await UcodeRepository.deleteToken({
  //       email: email,
  //       token: token,
  //     });

  //     return {
  //       success: true,
  //       message: 'Password updated successfully',
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

  async verifyEmail({ email, token }) {
    try {
      const user = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const existToken = await UcodeRepository.validateToken({
          email: email,
          token: token,
        });

        if (existToken) {
          await this.prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              email_verified_at: new Date(Date.now()),
            },
          });

          // delete otp code
          // await UcodeRepository.deleteToken({
          //   email: email,
          //   token: token,
          // });

          return {
            success: true,
            message: 'Email verified successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async resendVerificationEmail(email: string) {
    try {
      const user = await UserRepository.getUserByEmail(email);

      if (user) {
        // create otp code
        const token = await UcodeRepository.createToken({
          userId: user.id,
          isOtp: true,
        });

        // send otp code to email
        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: user.name,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent a verification code to your email',
        };
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async changePassword({ user_id, oldPassword, newPassword }) {
    const user = await UserRepository.getUserDetails(user_id);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await UserRepository.validatePassword({
      email: user.email,
      password: oldPassword,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid old password');
    }

    await UserRepository.changePassword({
      email: user.email,
      password: newPassword,
    });

    return {
      success: true,
      message: 'Password updated successfully',
    };
  }

  async requestEmailChange(user_id: string, email: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        const token = await UcodeRepository.createToken({
          userId: user.id,
          isOtp: true,
          email: email,
        });

        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: email,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent an OTP code to your email',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async changeEmail({
    user_id,
    new_email,
    token,
  }: {
    user_id: string;
    new_email: string;
    token: string;
  }) {
    try {
      const user = await UserRepository.getUserDetails(user_id);

      if (user) {
        const existToken = await UcodeRepository.validateToken({
          email: new_email,
          token: token,
          forEmailChange: true,
        });

        if (existToken) {
          await UserRepository.changeEmail({
            user_id: user.id,
            new_email: new_email,
          });

          // delete otp code
          await UcodeRepository.deleteToken({
            email: new_email,
            token: token,
          });

          return {
            success: true,
            message: 'Email updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // --------- 2FA ---------
  async generate2FASecret(user_id: string) {
    try {
      return await UserRepository.generate2FASecret(user_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async verify2FA(user_id: string, token: string) {
    try {
      const isValid = await UserRepository.verify2FA(user_id, token);
      if (!isValid) {
        return {
          success: false,
          message: 'Invalid token',
        };
      }
      return {
        success: true,
        message: '2FA verified successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async enable2FA(user_id: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        await UserRepository.enable2FA(user_id);
        return {
          success: true,
          message: '2FA enabled successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async disable2FA(user_id: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        await UserRepository.disable2FA(user_id);
        return {
          success: true,
          message: '2FA disabled successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  // --------- end 2FA ---------

  //-----------BRANCH MANAGER PART -------------

  async createManager({
    name,
    email,
    password,
    address,
    status,
  }: {
    name: string;
    email: string;
    password: string;
    address?: string;
    status?: string;
  }) {
    try {
      // Check if email already exists
      const userEmailExist = await UserRepository.exist({
        field: 'email',
        value: String(email),
      });

      if (userEmailExist) {
        return {
          success: false,
          message: 'Email already exists',
        };
      }

      // ✅ Create manager user
      const user = await UserRepository.createUser({
        name,
        email,
        password,
        address,
        status,
        type: 'manager', // fixed
      });

      if (!user || user.success === false) {
        return {
          success: false,
          message: 'Failed to create manager account',
        };
      }

      return {
        success: true,
        message: 'Manager account created successfully',
        data: user.data,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateManager(
    userId: string,
    updateDto: {
      name?: string;
      address?: string;
      status?: string;
    },
    image?: Express.Multer.File,
  ) {
    try {
      const data: any = {};

      if (updateDto.name) data.name = updateDto.name;
      if (updateDto.address) data.address = updateDto.address;
      if (updateDto.status) data.status = updateDto.status;

      // ✅ Handle avatar
      if (image) {
        const oldUser = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { avatar: true },
        });

        if (oldUser?.avatar) {
          await SojebStorage.delete(
            appConfig().storageUrl.avatar + '/' + oldUser.avatar,
          );
        }

        const fileName = `${StringHelper.randomString()}${image.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.avatar + '/' + fileName,
          image.buffer,
        );

        data.avatar = fileName;
      }

      // ✅ Update user (manager)
      const manager = await this.prisma.user.update({
        where: { id: userId },
        data,
      });

      return {
        success: true,
        message: 'Manager updated successfully',
        data: manager,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async toggleManagerStatus(userId: string) {
    try {
      // 1️⃣ Get current manager
      const manager = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { status: true, type: true },
      });

      if (!manager || manager.type !== 'manager') {
        return {
          success: false,
          message: 'Manager not found',
        };
      }

      // 2️⃣ Toggle status
      const newStatus = manager.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED';

      const updatedManager = await this.prisma.user.update({
        where: { id: userId },
        data: { status: newStatus },
      });

      return {
        success: true,
        message: `Manager status updated to ${newStatus}`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getAllManagers(status?: 'ACTIVE' | 'LOCKED', search?: string) {
    try {
      const baseWhere: any = { type: 'manager' };

      // Apply filter if status is provided
      // const whereCondition = status ? { ...baseWhere, status } : baseWhere;

      if (status) baseWhere.status = status;

      if (search) {
        baseWhere.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
          { status: { contains: search, mode: 'insensitive' } },
        ];
      }

      const managers = await this.prisma.user.findMany({
        where: baseWhere,
        select: {
          id: true,
          name: true,
          address: true,
          status: true,
          avatar: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: { created_at: 'desc' },
      });

      let summary: Record<string, number> = {};

      if (status === 'ACTIVE') {
        summary.totalActiveBranch = managers.length;
      } else if (status === 'LOCKED') {
        summary.totalLockedBranch = managers.length;
      } else {
        summary.totalBranch = managers.length;
        summary.totalActiveBranch = await this.prisma.user.count({
          where: { type: 'manager', status: 'ACTIVE' },
        });
        summary.totalLockedBranch = await this.prisma.user.count({
          where: { type: 'manager', status: 'LOCKED' },
        });
      }

      return {
        success: true,
        message: 'Managers fetched successfully',
        data: {
          summary,
          managers,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  //get single manager details
  // async getManagerById(userId: string) {
  //   try {

  //     const manager = await this.prisma.user.findUnique({
  //       where: { id: userId },
  //       select: {
  //         id: true,
  //         name: true,
  //         address: true,
  //         status: true,
  //         avatar: true,
  //         created_at: true,
  //         updated_at: true,
  //       },
  //     });

  //     if (!manager) {
  //       return {
  //         success: false,
  //         message: 'Manager not found',
  //       };
  //     }

  //     const orders = await this.prisma.order.findMany({
  //       where: { user_id: userId },
  //       select: {
  //         id: true,
  //         total_quantity: true,
  //         total_amount: true,
  //         status: true,
  //         created_at: true,
  //         order_items: {
  //           select: {
  //             id: true,
  //             quantity: true,
  //             price: true,
  //             product: {
  //               select: {
  //                 id: true,
  //                 name: true,
  //                 image: true,
  //               },
  //             },
  //           },
  //         },
  //       },
  //       orderBy: { created_at: 'desc' },
  //     });

  //     return {
  //       success: true,
  //       message: 'Manager with orders fetched successfully',
  //       data: {
  //         ...manager,
  //         totalOrders: orders.length,
  //         orders,
  //       },
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

  async getManagerById(userId: string, query?: { period?: string }) {
    try {
      // 1️⃣ Get manager details
      const manager = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          address: true,
          status: true,
          avatar: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!manager) {
        return { success: false, message: 'Manager not found' };
      }

      // 2️⃣ Period handling
      const { period = 'today' } = query || {};
      const now = new Date();

      const startOfDay = (date: Date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
      };

      const endOfDay = (date: Date) => {
        const d = new Date(date);
        d.setHours(23, 59, 59, 999);
        return d;
      };

      const startOfLast7Days = (date: Date) => {
        const d = new Date(date);
        d.setDate(d.getDate() - 6);
        d.setHours(0, 0, 0, 0);
        return d;
      };

      const startOfLast30Days = (date: Date) => {
        const d = new Date(date);
        d.setDate(d.getDate() - 29);
        d.setHours(0, 0, 0, 0);
        return d;
      };

      let dateFilter: { gte: Date; lte: Date };

      if (period === 'today') {
        dateFilter = {
          gte: startOfDay(now),
          lte: endOfDay(now),
        };
      } else if (period === 'week') {
        dateFilter = {
          gte: startOfLast7Days(now),
          lte: endOfDay(now),
        };
      } else if (period === 'month') {
        dateFilter = {
          gte: startOfLast30Days(now),
          lte: endOfDay(now),
        };
      } else {
        const parsedDate = new Date(period);
        if (!isNaN(parsedDate.getTime())) {
          dateFilter = {
            gte: startOfDay(parsedDate),
            lte: endOfDay(parsedDate),
          };
        } else {
          dateFilter = {
            gte: startOfDay(now),
            lte: endOfDay(now),
          };
        }
      }

      // 3️⃣ Order filter
      const where: Prisma.OrderWhereInput = {
        created_at: dateFilter,
      };

      // 4️⃣ Fetch filtered orders
      const orders = await this.prisma.order.findMany({
        where,
        select: {
          id: true,
          created_at: true,
          order_items: {
            select: {
              id: true,
              quantity: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      return {
        success: true,
        message: 'Manager fetched successfully',
        data: {
          ...manager,
          totalOrders: orders.length,
          orders: orders.map((order) => ({
            ...order,
            order_items: order.order_items.map(({ product, ...item }) => ({
              ...item,
              product_name: product?.name,
              product_id: product?.id,
              product_image: product?.image
                ? SojebStorage.url(
                    `${appConfig().storageUrl.product}/${product.image}`,
                  )
                : null,
            })),
          })),
        },
      };
    } catch (error: any) {
      console.error(error);
      return {
        success: false,
        message: error.message || 'Something went wrong',
      };
    }
  }

  async getDrivers() {
    const drivers = await this.prisma.user.findMany({
      where: { type: 'driver', status: status.ACTIVE },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
    return {
      success: true,
      message: 'Drivers fetched successfully',
      data: drivers || [],
    };
  }

  async getAdminStats() {
    const [
      totalInvoice,
      paidInvoice,
      activeBranch,
      lockedBranch,
      totalOrder,
      totalCompletedOrders,
      todaysDelivery,
      assignedDelivery,
    ] = await this.prisma.$transaction([
      this.prisma.invoice.count(),
      this.prisma.invoice.count({
        where: {
          status: InvoiceStatus.PAID,
        },
      }),
      this.prisma.user.count({
        where: {
          type: 'manager',
          status: 'ACTIVE',
        },
      }),
      this.prisma.user.count({
        where: {
          type: 'manager',
          status: 'LOCKED',
        },
      }),
      this.prisma.order.count(),
      this.prisma.order.count({
        where: {
          status: OrderStatus.COMPLETED,
        },
      }),
      this.prisma.delivery.count({
        where: {
          created_at: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      }),
      this.prisma.delivery.count({
        where: {
          status: DeliveryStatus.ASSIGNED,
        },
      }),
    ]);

    return {
      success: true,
      message: 'Admin stats fetched successfully',
      data: {
        invoice: {
          total_invoice: totalInvoice,
          paid_invoice: paidInvoice,
        },
        branch: {
          active_branch: activeBranch,
          locked_branch: lockedBranch,
        },
        order: {
          total_order: totalOrder,
          total_completed_order: totalCompletedOrders,
        },
        delivery: {
          todays_delivery: todaysDelivery,
          assigned_delivery: assignedDelivery,
        },
      },
    };
  }

  // --------- USER APPROVAL METHODS ---------

  /**
   * Get all pending manager and driver approvals
   */
  async getPendingApprovals(type?: 'manager' | 'driver') {
    try {
      const where: any = {
        approved_by: 'PENDING',
      };

      if (type) {
        where.type = type;
      } else {
        // include admin as well when retrieving pending approvals
        where.type = {
          in: ['manager', 'driver', 'admin'],
        };
      }

      const pendingUsers = await this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          type: true,
          created_at: true,
          address: true,
          phone_number: true,
          driver_id: true,
          approved_by: true,
        },
        orderBy: { created_at: 'desc' },
      });

      return {
        success: true,
        message: 'Pending approvals fetched successfully',
        data: {
          total: pendingUsers.length,
          users: pendingUsers,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Approve or Reject a pending manager or driver
   */
  async updateUserApprovalStatus(
    userId: string,
    adminId: string,
    status: 'APPROVED' | 'REJECTED',
  ) {
    try {
      // Check if user exists and is pending
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          type: true,
          approved_by: true,
          email: true,
          name: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (
        user.type !== 'manager' &&
        user.type !== 'driver' &&
        user.type !== 'admin'
      ) {
        return {
          success: false,
          message:
            'Only managers, drivers, and admins can be approved or rejected',
        };
      }

      if (user.approved_by !== 'PENDING') {
        return {
          success: false,
          message: `User has already been ${user.approved_by.toLowerCase()}`,
        };
      }

      // Update user approval status
      const updateData: any = {
        approved_by: status,
      };

      if (status === 'APPROVED') {
        updateData.approved_at = new Date();
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          type: true,
          approved_by: true,
          approved_at: true,
        },
      });

      // TODO: Send email notification based on approval status
      // if (status === 'APPROVED') {
      //   await this.mailService.sendApprovalEmail({
      //     email: updatedUser.email,
      //     name: updatedUser.name,
      //   });
      // } else {
      //   await this.mailService.sendRejectionEmail({
      //     email: updatedUser.email,
      //     name: updatedUser.name,
      //   });
      // }

      const actionText = status === 'APPROVED' ? 'approved' : 'rejected';
      const userTypeText =
        user.type === 'manager'
          ? 'Manager'
          : user.type === 'driver'
            ? 'Driver'
            : 'Admin';

      return {
        success: true,
        message: `${userTypeText} ${actionText} successfully`,
        data: updatedUser,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Notify all admins (with FCM tokens) about a new pending approval
   */
  private async notifyAdminsNewPendingApproval(payload: {
    id: string;
    name?: string;
    email: string;
    type: string;
  }) {
    try {
      // only notify admins who are already approved and have an fcm token
      const admins = await this.prisma.user.findMany({
        where: {
          type: 'admin',
          approved_by: 'APPROVED',
          fcm_token: { not: null },
        },
        select: { id: true, name: true, fcm_token: true },
      });

      if (!admins || admins.length === 0) return;

      const text = `${payload.name || payload.email}  is awaiting for your approval as a ${payload.type}.`;

      for (const a of admins) {
        try {
          // Save notification and send push via NotificationService
          await this.notificationService.sendNotification({
            sender_id: payload.id,
            receiver_id: a.id,
            text,
            type: 'approval',
            entity_id: payload.id,
          });
        } catch (err) {
          console.warn('Failed to notify admin', a.id, err);
        }
      }
    } catch (err) {
      console.warn('notifyAdminsNewPendingApproval error', err);
    }
  }

  // --------- END USER APPROVAL METHODS ---------
}
