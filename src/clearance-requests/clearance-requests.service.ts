import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBulkClearanceRequestDto } from './dto/create-bulk-clearance-request.dto';
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

  async createBulk(user: User, createDto: CreateBulkClearanceRequestDto) {
    // Fetch all active departments and faculties
    const activeDepartments = await this.prisma.department.findMany({
      where: { isActive: true },
    });
    
    const activeFaculties = await this.prisma.faculty.findMany({
      where: { isActive: true },
    });

    if (activeDepartments.length === 0 && activeFaculties.length === 0) {
      throw new ConflictException('There are no active departments or faculties for clearance at this time.');
    }

    // Ensure student hasn't already requested clearance for ANY of these departments
    const existingRequests = await this.prisma.clearanceRequest.findMany({
      where: {
        studentId: user.id,
      },
    });

    if (existingRequests.length > 0) {
      throw new ConflictException('You have already initiated clearance requests.');
    }

    // Map provided submissions
    const submissionsMap = new Map();
    if (createDto.submissions) {
      for (const sub of createDto.submissions) {
        if (sub.departmentId) submissionsMap.set(`dept_${sub.departmentId}`, sub.documents || []);
        if (sub.facultyId) submissionsMap.set(`fac_${sub.facultyId}`, sub.documents || []);
      }
    }

    // Validate requirements
    for (const dept of activeDepartments) {
      if (dept.requiresDocument) {
        const providedDocs = submissionsMap.get(`dept_${dept.id}`);
        if (!providedDocs || providedDocs.length === 0) {
          throw new BadRequestException(`Department ${dept.name} requires a document submission: ${dept.requiredDocumentDescription || 'No description provided.'}`);
        }
      }
    }
    for (const fac of activeFaculties) {
      if (fac.requiresDocument) {
        const providedDocs = submissionsMap.get(`fac_${fac.id}`);
        if (!providedDocs || providedDocs.length === 0) {
          throw new BadRequestException(`Faculty ${fac.name} requires a document submission: ${fac.requiredDocumentDescription || 'No description provided.'}`);
        }
      }
    }

    // Execute in transaction
    const createdRequests = await this.prisma.$transaction(async (prisma) => {
      const requests: any[] = [];
      for (const dept of activeDepartments) {
        const documents = submissionsMap.get(`dept_${dept.id}`) || [];
        
        const request = await prisma.clearanceRequest.create({
          data: {
            studentId: user.id,
            departmentId: dept.id,
            documents: {
              create: documents,
            },
          },
          include: {
            documents: true,
            department: true,
          }
        });
        requests.push(request);
      }

      for (const fac of activeFaculties) {
        const documents = submissionsMap.get(`fac_${fac.id}`) || [];
        
        const request = await prisma.clearanceRequest.create({
          data: {
            studentId: user.id,
            facultyId: fac.id,
            documents: {
              create: documents,
            },
          },
          include: {
            documents: true,
            faculty: true,
          }
        });
        requests.push(request);
      }
      return requests;
    });

    return createdRequests;
  }

  async findAll(user: User) {
    if (user.role === Role.STUDENT) {
      return this.prisma.clearanceRequest.findMany({
        where: { studentId: user.id },
        include: { department: true, faculty: true, documents: true },
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

    if (user.role === Role.FACULTY_OFFICER) {
      if (!user.facultyId) {
        return [];
      }
      return this.prisma.clearanceRequest.findMany({
        where: { facultyId: user.facultyId },
        include: { student: { select: { id: true, name: true, email: true } }, documents: true },
      });
    }

    // ADMIN sees all
    return this.prisma.clearanceRequest.findMany({
      include: {
        student: { select: { id: true, name: true, email: true } },
        department: true,
        faculty: true,
      },
    });
  }

  async findOne(id: string, user: User) {
    const request = await this.prisma.clearanceRequest.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, name: true, email: true } },
        department: true,
        faculty: true,
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

    if (user.role === Role.FACULTY_OFFICER && request.facultyId !== user.facultyId) {
      throw new ForbiddenException('You can only view clearance requests for your faculty');
    }

    // Auto transition PENDING to UNDER_REVIEW when officer views it
    if ((user.role === Role.DEPARTMENT_OFFICER || user.role === Role.FACULTY_OFFICER) && request.status === ClearanceStatus.PENDING) {
      const updated = await this.prisma.clearanceRequest.update({
        where: { id },
        data: { status: ClearanceStatus.UNDER_REVIEW },
        include: {
          student: { select: { id: true, name: true, email: true } },
          department: true,
          faculty: true,
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
      include: { department: true, faculty: true },
    });

    if (!request) {
      throw new NotFoundException(`Clearance request with ID ${id} not found`);
    }

    if (user.role === Role.DEPARTMENT_OFFICER && request.departmentId !== user.departmentId) {
      throw new ForbiddenException('You can only modify clearance requests for your department');
    }

    if (user.role === Role.FACULTY_OFFICER && request.facultyId !== user.facultyId) {
      throw new ForbiddenException('You can only modify clearance requests for your faculty');
    }

    let dataToUpdate: any = { status };

    if (status === ClearanceStatus.REJECTED) {
      if (!updateDto.remarks || updateDto.remarks.trim() === '') {
        throw new BadRequestException('Remarks are compulsory when rejecting a clearance request.');
      }
      dataToUpdate.remarks = updateDto.remarks;
    } else if (status === ClearanceStatus.APPROVED) {
      if (!user.signatureUrl) {
        throw new BadRequestException('You must upload your signature before approving clearance requests.');
      }
      dataToUpdate.clearedByOfficerName = user.name || 'Unknown Officer';
      dataToUpdate.clearedBySignatureUrl = user.signatureUrl;
      dataToUpdate.clearedAt = new Date();
      if (updateDto.remarks) {
        dataToUpdate.remarks = updateDto.remarks;
      }
    } else {
      if (updateDto.remarks) {
        dataToUpdate.remarks = updateDto.remarks;
      }
    }

    const updated = await this.prisma.clearanceRequest.update({
      where: { id },
      data: dataToUpdate,
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
        `Your clearance request for ${request.department?.name || request.faculty?.name} has been approved.`,
        NotificationType.SUCCESS,
      );
      await this.checkAndCompleteStudentClearance(request.studentId);
    } else if (status === ClearanceStatus.REJECTED) {
      await this.notificationsService.createNotification(
        request.studentId,
        'Clearance Request Rejected',
        `Your clearance request for ${request.department?.name || request.faculty?.name} has been rejected. Remarks: ${updateDto.remarks || 'None'}`,
        NotificationType.ERROR,
      );
    }

    return updated;
  }

  async checkAndCompleteStudentClearance(studentId: string) {
    // Check if the student has APPROVED requests for ALL active departments and ALL active faculties
    const activeDepartmentsCount = await this.prisma.department.count({
      where: { isActive: true },
    });
    const activeFacultiesCount = await this.prisma.faculty.count({
      where: { isActive: true },
    });

    const approvedRequestsCount = await this.prisma.clearanceRequest.count({
      where: {
        studentId,
        status: ClearanceStatus.APPROVED,
        OR: [
          { department: { isActive: true } },
          { faculty: { isActive: true } },
        ]
      },
    });

    if ((activeDepartmentsCount + activeFacultiesCount) > 0 && approvedRequestsCount === (activeDepartmentsCount + activeFacultiesCount)) {
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
