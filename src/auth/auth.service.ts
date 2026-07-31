import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { LoginDto, RegisterDto, ForgotPasswordDto, ResetPasswordDto, UpdateProfileDto, ChangePasswordDto } from './dto/auth.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(pass, user.password)) {
      return user;
    }
    return null;
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new BadRequestException('Email is already in use');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');

    let facultyId: string | undefined = undefined;
    if (registerDto.departmentId) {
      const dept = await this.usersService['prisma'].department.findUnique({ where: { id: registerDto.departmentId } });
      if (!dept) throw new BadRequestException('Department not found');
      facultyId = dept.facultyId || undefined;
    }

    const user = await this.usersService.create({
      email: registerDto.email,
      password: hashedPassword,
      name: registerDto.name,
      emailVerifyToken,
      department: { connect: { id: registerDto.departmentId } },
      ...(facultyId ? { faculty: { connect: { id: facultyId } } } : {})
    });

    try {
      await this.mailService.sendVerificationEmail(user.email, emailVerifyToken);
    } catch (error) {
      this.logger.error('Failed to send verification email during registration', error);
      // We still return success as user is created, they can request another email later
    }

    return { message: 'Registration successful. Please check your email to verify your account.' };
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been disabled. Please contact support.');
    }
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email address before logging in.');
    }

    return this.generateTokens(user);
  }

  async verifyEmail(token: string) {
    const user = await this.usersService.findByEmailVerifyToken(token);
    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    await this.usersService.update(user.id, {
      isEmailVerified: true,
      emailVerifyToken: null,
    });

    return { message: 'Email successfully verified. You can now login.' };
  }

  async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role, departmentId: user.departmentId };
    
    const accessToken = this.jwtService.sign(payload);
    
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      }
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException('User not found');

      return this.generateTokens(user);
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);
    if (!user) {
      // Return a generic message even if user not found to prevent email enumeration
      return { message: 'If that email address is in our database, we will send you an email to reset your password.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // 1 hour expiry

    await this.usersService.updateResetToken(user.id, resetToken, resetTokenExpiry);

    // Call mail service
    try {
      await this.mailService.sendPasswordResetEmail(user.email, resetToken);
    } catch (error) {
      // Revert token if email fails
      await this.usersService.updateResetToken(user.id, null, null);
      throw new BadRequestException('Failed to send reset email');
    }

    return { message: 'If that email address is in our database, we will send you an email to reset your password.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const user = await this.usersService.findByResetToken(resetPasswordDto.token);

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);

    await this.usersService.update(user.id, {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    });

    return { message: 'Password has been successfully reset' };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    return this.usersService.update(userId, updateProfileDto);
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const isPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid current password');
    }

    const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);
    await this.usersService.update(userId, { password: hashedNewPassword });

    return { message: 'Password has been successfully changed' };
  }
}
