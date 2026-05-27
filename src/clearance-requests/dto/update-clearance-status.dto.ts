import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateClearanceStatusDto {
  @ApiProperty({ example: 'All documents verified and accurate.', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}
