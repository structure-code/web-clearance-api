import { Module } from '@nestjs/common';
import { ClearanceRequestsService } from './clearance-requests.service';
import { ClearanceRequestsController } from './clearance-requests.controller';
import { PrismaModule } from '../prisma/prisma.module';

import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

import { NotificationsModule } from '../notifications/notifications.module';
import { CertificatesModule } from '../certificates/certificates.module';

@Module({
  imports: [PrismaModule, ActivityLogsModule, NotificationsModule, CertificatesModule],
  controllers: [ClearanceRequestsController],
  providers: [ClearanceRequestsService],
  exports: [ClearanceRequestsService],
})
export class ClearanceRequestsModule {}
