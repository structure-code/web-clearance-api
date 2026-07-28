import { IsArray, IsNotEmpty, IsUUID, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentDto } from './create-clearance-request.dto';

export class DepartmentSubmissionDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  departmentId!: string;

  @ApiProperty({ type: [DocumentDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentDto)
  @IsOptional()
  documents?: DocumentDto[];
}

export class CreateBulkClearanceRequestDto {
  @ApiProperty({ type: [DepartmentSubmissionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentSubmissionDto)
  submissions!: DepartmentSubmissionDto[];
}
