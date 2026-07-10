import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'student@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'student@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'John Doe', required: false })
  @IsString()
  name?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'student@example.com' })
  @IsEmail()
  email!: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'newpassword123' })
  @IsString()
  @MinLength(6)
  newPassword!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class UpdateProfileDto {
  @ApiProperty({ example: 'John Doe', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'uuid-department-id', required: false })
  @IsOptional()
  @IsString()
  departmentId?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'oldpassword123' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ example: 'newpassword123' })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
