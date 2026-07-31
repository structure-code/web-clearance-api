import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'student@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'John Doe', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ enum: Role, example: Role.STUDENT })
  @IsEnum(Role)
  role!: Role;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @ValidateIf(o => o.role === Role.STUDENT)
  @IsNotEmpty()
  @IsString()
  departmentId?: string;

  @ApiProperty({ example: 'uuid-faculty-id', required: false })
  @IsString()
  @IsOptional()
  facultyId?: string;
}
