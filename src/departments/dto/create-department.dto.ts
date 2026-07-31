import { IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Library' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'LIB' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: false, required: false, description: 'Whether students must attach a supporting document when requesting clearance from this department' })
  @IsBoolean()
  @IsOptional()
  requiresDocument?: boolean;

  @ApiProperty({ example: 'Upload your library clearance slip', required: false, description: 'Shown to students when requiresDocument is true' })
  @IsString()
  @IsOptional()
  requiredDocumentDescription?: string;
}
