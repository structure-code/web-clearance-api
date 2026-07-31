import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignFacultyOfficerDto {
  @ApiProperty({ example: 'uuid-user-id' })
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
