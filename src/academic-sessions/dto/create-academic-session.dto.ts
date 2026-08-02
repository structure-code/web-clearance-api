import { ApiProperty } from '@nestjs/swagger';
import { Semester } from '@prisma/client';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAcademicSessionDto {
  @ApiProperty({ example: '2025/2026' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: Semester, example: Semester.FIRST })
  @IsEnum(Semester)
  semester!: Semester;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
