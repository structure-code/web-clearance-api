import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AcademicSessionsController } from './academic-sessions.controller';
import { AcademicSessionsService } from './academic-sessions.service';

@Module({
  imports: [PrismaModule],
  controllers: [AcademicSessionsController],
  providers: [AcademicSessionsService],
})
export class AcademicSessionsModule {}
