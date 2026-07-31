import { PartialType } from '@nestjs/swagger';
import { CreateFacultyDto } from './create-faculty.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFacultyDto extends PartialType(CreateFacultyDto) {
  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
