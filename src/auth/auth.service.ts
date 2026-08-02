import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { AdminLoginDto, StudentLoginDto, RegisterDto, ForgotPasswordDto, ResetPasswordDto, UpdateProfileDto, ChangePasswordDto } from './dto/auth.dto';
import { User, Role } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  async validateAdminUser(email: string, pass: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(pass, user.password)) {
      return user;
    }
    return null;
  }

  async validateStudentUser(matricNo: string, pass: string): Promise<User | null> {
    const user = await this.usersService.findByMatricNo(matricNo);
    if (user && user.role === Role.STUDENT && await bcrypt.compare(pass, user.password)) {
      return user;
    }
    return null;
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByMatricNo(registerDto.matricNo);
    if (existingUser) {
      throw new BadRequestException('Matriculation number is already in use');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    let facultyId: string | undefined = undefined;
    if (registerDto.programId) {
      const prog = await this.usersService['prisma'].program.findUnique({ where: { id: registerDto.programId } });
      if (!prog) throw new BadRequestException('Program not found');
      facultyId = prog.facultyId || undefined;
    }

    const user = await this.usersService.create({
      matricNo: registerDto.matricNo,
      password: hashedPassword,
      name: registerDto.name,
      role: Role.STUDENT,
      isEmailVerified: true, // No email verification required for students
      program: { connect: { id: registerDto.programId } },
      ...(facultyId ? { faculty: { connect: { id: facultyId } } } : {})
    });

    return { message: 'Registration successful. You can now login using your Matric No.' };
  }

  async adminLogin(adminLoginDto: AdminLoginDto) {
    const user = await this.validateAdminUser(adminLoginDto.email, adminLoginDto.password);
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

  async studentLogin(studentLoginDto: StudentLoginDto) {
    const user = await this.validateStudentUser(studentLoginDto.matricNo, studentLoginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been disabled. Please contact support.');
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
    if (!user || !user.email) {
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

  async updateProfile(user: User, updateProfileDto: UpdateProfileDto) {
    if (updateProfileDto.signatureUrl && user.role !== Role.DEPARTMENT_OFFICER && user.role !== Role.FACULTY_OFFICER) {
      throw new BadRequestException('Only department and faculty officers can upload a signature.');
    }
    return this.usersService.update(user.id, updateProfileDto);
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
