import { IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFacultyDto {
  @ApiProperty({ example: 'Science' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'FSC' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: false, required: false, description: 'Whether students must attach a supporting document when requesting clearance from this faculty' })
  @IsBoolean()
  @IsOptional()
  requiresDocument?: boolean;

  @ApiProperty({ example: 'Upload your faculty clearance slip', required: false, description: 'Shown to students when requiresDocument is true' })
  @IsString()
  @IsOptional()
  requiredDocumentDescription?: string;
}
