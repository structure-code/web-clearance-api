import { Module } from '@nestjs/common';
import { ClearanceRequestsService } from './clearance-requests.service';
import { ClearanceRequestsController } from './clearance-requests.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClearanceRequestsController],
  providers: [ClearanceRequestsService],
  exports: [ClearanceRequestsService],
})
export class ClearanceRequestsModule {}
