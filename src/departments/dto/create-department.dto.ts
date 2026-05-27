import { IsNotEmpty, IsString } from 'class-validator';
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
}
