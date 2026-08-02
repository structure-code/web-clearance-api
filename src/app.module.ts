import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DepartmentsModule } from './departments/departments.module';
import { FilesModule } from './files/files.module';
import { ClearanceRequestsModule } from './clearance-requests/clearance-requests.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CertificatesModule } from './certificates/certificates.module';
import { FacultiesModule } from './faculties/faculties.module';
import { ProgramsModule } from './programs/programs.module';
import { AcademicSessionsModule } from './academic-sessions/academic-sessions.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    MailModule,
    UsersModule,
    AuthModule,
    DepartmentsModule,
    FilesModule,
    ClearanceRequestsModule,
    ActivityLogsModule,
    NotificationsModule,
    CertificatesModule,
    FacultiesModule,
    ProgramsModule,
    AcademicSessionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
