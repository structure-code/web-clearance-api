import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClearanceRequestDto } from './dto/create-clearance-request.dto';
import { UpdateClearanceStatusDto } from './dto/update-clearance-status.dto';
import { User, ClearanceStatus, Role } from '@prisma/client';

import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CertificatesService } from '../certificates/certificates.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class ClearanceRequestsService {
  constructor(
    private prisma: PrismaService,
    private activityLogsService: ActivityLogsService,
    private notificationsService: NotificationsService,
    private certificatesService: CertificatesService,
  ) {}

  async create(user: User, createDto: CreateClearanceRequestDto) {
    // Check if the department is active
    const department = await this.prisma.department.findUnique({
      where: { id: createDto.departmentId },
    });

    if (!department || !department.isActive) {
      throw new NotFoundException('Department not found or inactive');
    }

    // Ensure student hasn't already requested clearance from this department
    const existing = await this.prisma.clearanceRequest.findUnique({
      where: {
        studentId_departmentId: {
          studentId: user.id,
          departmentId: createDto.departmentId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('You have already submitted a clearance request for this department');
    }

    return this.prisma.clearanceRequest.create({
      data: {
        studentId: user.id,
        departmentId: createDto.departmentId,
        documents: {
          create: createDto.documents,
        },
      },
      include: {
        documents: true,
      },
    });
  }

  async findAll(user: User) {
    if (user.role === Role.STUDENT) {
      return this.prisma.clearanceRequest.findMany({
        where: { studentId: user.id },
        include: { department: true, documents: true },
      });
    }

    if (user.role === Role.DEPARTMENT_OFFICER) {
      if (!user.departmentId) {
        return [];
      }
      return this.prisma.clearanceRequest.findMany({
        where: { departmentId: user.departmentId },
        include: { student: { select: { id: true, name: true, email: true } }, documents: true },
      });
    }

    // ADMIN sees all
    return this.prisma.clearanceRequest.findMany({
      include: {
        student: { select: { id: true, name: true, email: true } },
        department: true,
      },
    });
  }

  async findOne(id: string, user: User) {
    const request = await this.prisma.clearanceRequest.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, name: true, email: true } },
        department: true,
        documents: true,
      },
    });

    if (!request) {
      throw new NotFoundException(`Clearance request with ID ${id} not found`);
    }

    // Authorization checks
    if (user.role === Role.STUDENT && request.studentId !== user.id) {
      throw new ForbiddenException('You can only view your own clearance requests');
    }

    if (user.role === Role.DEPARTMENT_OFFICER && request.departmentId !== user.departmentId) {
      throw new ForbiddenException('You can only view clearance requests for your department');
    }

    // Auto transition PENDING to UNDER_REVIEW when officer views it
    if (user.role === Role.DEPARTMENT_OFFICER && request.status === ClearanceStatus.PENDING) {
      const updated = await this.prisma.clearanceRequest.update({
        where: { id },
        data: { status: ClearanceStatus.UNDER_REVIEW },
        include: {
          student: { select: { id: true, name: true, email: true } },
          department: true,
          documents: true,
        },
      });
      return updated;
    }

    return request;
  }

  async updateStatus(
    id: string,
    user: User,
    status: ClearanceStatus,
    updateDto: UpdateClearanceStatusDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const request = await this.prisma.clearanceRequest.findUnique({
      where: { id },
      include: { department: true },
    });

    if (!request) {
      throw new NotFoundException(`Clearance request with ID ${id} not found`);
    }

    if (user.role === Role.DEPARTMENT_OFFICER && request.departmentId !== user.departmentId) {
      throw new ForbiddenException('You can only modify clearance requests for your department');
    }

    const updated = await this.prisma.clearanceRequest.update({
      where: { id },
      data: {
        status,
        remarks: updateDto.remarks,
      },
    });

    // Log the activity
    await this.activityLogsService.logAction(
      user.id,
      `${status}_CLEARANCE`,
      id,
      'ClearanceRequest',
      ipAddress,
      userAgent,
    );

    if (status === ClearanceStatus.APPROVED) {
      await this.notificationsService.createNotification(
        request.studentId,
        'Clearance Request Approved',
        `Your clearance request for ${request.department.name} has been approved.`,
        NotificationType.SUCCESS,
      );
      await this.checkAndCompleteStudentClearance(request.studentId);
    } else if (status === ClearanceStatus.REJECTED) {
      await this.notificationsService.createNotification(
        request.studentId,
        'Clearance Request Rejected',
        `Your clearance request for ${request.department.name} has been rejected. Remarks: ${updateDto.remarks || 'None'}`,
        NotificationType.ERROR,
      );
    }

    return updated;
  }

  async checkAndCompleteStudentClearance(studentId: string) {
    // Check if the student has APPROVED requests for ALL active departments
    const activeDepartmentsCount = await this.prisma.department.count({
      where: { isActive: true },
    });

    const approvedRequestsCount = await this.prisma.clearanceRequest.count({
      where: {
        studentId,
        status: ClearanceStatus.APPROVED,
        department: { isActive: true },
      },
    });

    if (activeDepartmentsCount > 0 && approvedRequestsCount === activeDepartmentsCount) {
      // Mark all of the student's requests as COMPLETED
      await this.prisma.clearanceRequest.updateMany({
        where: { studentId },
        data: { status: ClearanceStatus.COMPLETED },
      });

      // Generate the Certificate
      await this.certificatesService.generateCertificate(studentId);

      // Send final completion notification
      await this.notificationsService.createNotification(
        studentId,
        'Final Clearance Completed',
        'Congratulations! You have successfully completed all your departmental clearances. You can now download your Certificate of Clearance.',
        NotificationType.SUCCESS,
      );
    }
  }

  // Admin override to set a request directly to COMPLETED or any state
  async adminUpdateStatus(id: string, status: ClearanceStatus) {
    return this.prisma.clearanceRequest.update({
      where: { id },
      data: { status },
    });
  }
}
