import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Role } from '@prisma/client';

@Injectable()
export class ActivityLogsService {
  constructor(private prisma: PrismaService) {}

  async logAction(
    userId: string,
    action: string,
    entityId?: string,
    entityType?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.activityLog.create({
      data: {
        userId,
        action,
        entityId,
        entityType,
        ipAddress,
        userAgent,
      },
    });
  }

  async findAll(user: User) {
    if (user.role === Role.ADMIN) {
      return this.prisma.activityLog.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      });
    }

    if (user.role === Role.DEPARTMENT_OFFICER) {
      // Find logs only where the entityId corresponds to a ClearanceRequest in their department
      // This requires joining through ClearanceRequest.
      const logs = await this.prisma.activityLog.findMany({
        where: {
          entityType: 'ClearanceRequest',
        },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      // Filter in memory for now (or could use a complex where with prisma if supported)
      // Since entityId is just a string, Prisma doesn't know it's a ClearanceRequest relation
      // We will fetch all ClearanceRequests for this department to filter
      if (!user.departmentId) return [];

      const requests = await this.prisma.clearanceRequest.findMany({
        where: { departmentId: user.departmentId },
        select: { id: true },
      });

      const requestIds = requests.map((req) => req.id);
      
      return logs.filter((log) => log.entityId && requestIds.includes(log.entityId));
    }

    throw new ForbiddenException('You do not have permission to view activity logs');
  }
}
