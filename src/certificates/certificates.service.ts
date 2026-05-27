import { Injectable, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { ClearanceStatus } from '@prisma/client';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
const PDFDocument = require('pdfkit');

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    private prisma: PrismaService,
    private filesService: FilesService,
    private configService: ConfigService,
  ) {}

  async generateCertificate(studentId: string) {
    // 1. Fetch student and all clearance requests
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      include: {
        clearanceRequests: {
          include: { department: true },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Verify all active departments are cleared
    const activeDepartmentsCount = await this.prisma.department.count({
      where: { isActive: true },
    });

    const approvedRequests = student.clearanceRequests.filter(
      (req) => req.status === ClearanceStatus.COMPLETED || req.status === ClearanceStatus.APPROVED,
    );

    if (approvedRequests.length < activeDepartmentsCount) {
      throw new InternalServerErrorException('Student has not completed all clearances');
    }

    // 2. Generate Verification Token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const verifyUrl = `${frontendUrl}/verify-certificate?token=${verificationToken}`;

    // 3. Generate QR Code Buffer
    let qrBuffer: Buffer;
    try {
      qrBuffer = await QRCode.toBuffer(verifyUrl, {
        errorCorrectionLevel: 'H',
        type: 'png',
        margin: 1,
        width: 150,
      });
    } catch (err) {
      this.logger.error('Failed to generate QR Code', err);
      throw new InternalServerErrorException('Failed to generate QR code');
    }

    // 4. Generate PDF
    const pdfBuffer = await this.createPdfBuffer(student, approvedRequests, qrBuffer, verificationToken);

    // 5. Upload to S3
    const fileName = `certificate_${student.id.substring(0, 8)}_${Date.now()}.pdf`;
    const uploadResult = await this.filesService.uploadBuffer(pdfBuffer, fileName, 'application/pdf');

    // 6. Save Certificate Record
    const certificate = await this.prisma.certificate.create({
      data: {
        studentId,
        verificationToken,
        fileUrl: uploadResult.fileUrl,
      },
    });

    return certificate;
  }

  private createPdfBuffer(student: any, approvedRequests: any[], qrBuffer: Buffer, token: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);

      // Draw PDF Content
      doc.fontSize(25).text('CERTIFICATE OF CLEARANCE', { align: 'center' });
      doc.moveDown();

      doc.fontSize(14).text('This is to certify that', { align: 'center' });
      doc.moveDown();
      doc.fontSize(20).text(`${student.name || student.email}`, { align: 'center', underline: true });
      doc.moveDown();

      doc.fontSize(14).text(`Student ID: ${student.id}`, { align: 'center' });
      doc.moveDown(2);

      doc.text('Has successfully completed all required departmental clearances as listed below:', { align: 'left' });
      doc.moveDown();

      // List Departments
      doc.fontSize(12);
      approvedRequests.forEach((req, index) => {
        doc.text(`${index + 1}. ${req.department.name} - Cleared`);
      });

      doc.moveDown(3);

      const issuedDate = new Date().toLocaleDateString();
      doc.fontSize(12).text(`Date Issued: ${issuedDate}`, { align: 'left' });

      // Add QR Code
      // Position it at the bottom right
      doc.image(qrBuffer, doc.page.width - 200, doc.page.height - 200, { width: 100 });
      doc.fontSize(8).text(`Token: ${token.substring(0, 8)}...`, doc.page.width - 200, doc.page.height - 90);

      doc.end();
    });
  }

  async verifyCertificate(token: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { verificationToken: token },
      include: {
        student: {
          select: { name: true, email: true, id: true },
        },
      },
    });

    if (!certificate) {
      throw new NotFoundException('Invalid or missing certificate token');
    }

    return {
      isValid: true,
      issuedAt: certificate.issuedAt,
      studentName: certificate.student.name || certificate.student.email,
      studentId: certificate.student.id,
      fileUrl: certificate.fileUrl,
    };
  }

  async getMyCertificate(studentId: string) {
    let certificate = await this.prisma.certificate.findUnique({
      where: { studentId },
    });

    if (!certificate) {
      // Check if they are eligible to have one (maybe generation failed previously)
      const student = await this.prisma.user.findUnique({
        where: { id: studentId },
        include: { clearanceRequests: true },
      });

      if (student) {
        const activeDepartmentsCount = await this.prisma.department.count({
          where: { isActive: true },
        });

        const completedRequests = student.clearanceRequests.filter(
          (req) => req.status === ClearanceStatus.COMPLETED || req.status === ClearanceStatus.APPROVED,
        );

        if (activeDepartmentsCount > 0 && completedRequests.length === activeDepartmentsCount) {
          // Generate the missing certificate
          certificate = await this.generateCertificate(studentId);
          return certificate;
        }
      }

      throw new NotFoundException('Certificate not found. You may not have completed all clearances yet.');
    }

    return certificate;
  }
}
