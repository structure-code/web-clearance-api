import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateDepartmentDto } from './create-department.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {
  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
