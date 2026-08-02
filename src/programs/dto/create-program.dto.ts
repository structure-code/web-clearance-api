import { IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProgramDto {
  @ApiProperty({ example: 'Computer Science' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'CSC' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'uuid' })
  @IsString()
  @IsNotEmpty()
  facultyId!: string;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}