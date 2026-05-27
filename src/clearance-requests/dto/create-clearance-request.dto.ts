import { IsArray, IsNotEmpty, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class DocumentDto {
  @ApiProperty({ example: 'receipt.pdf' })
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({ example: 'https://s3.amazonaws.com/.../receipt.pdf' })
  @IsNotEmpty()
  fileUrl!: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsNotEmpty()
  fileType!: string;

  @ApiProperty({ example: 102400 })
  @IsNotEmpty()
  fileSize!: number;
}

export class CreateClearanceRequestDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  departmentId!: string;

  @ApiProperty({ type: [DocumentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentDto)
  documents!: DocumentDto[];
}
