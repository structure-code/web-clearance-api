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

  async generateCertificate(studentId: string, academicSessionId: string) {
    // 1. Fetch student and all clearance requests
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      include: {
        clearanceRequests: {
          where: { academicSessionId },
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

    // 4. Fetch Logo Buffer
    let logoBuffer: Buffer | undefined;
    try {
      const response = await fetch('https://i.postimg.cc/fb1TPJNz/adun-logo.jpg');
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        logoBuffer = Buffer.from(arrayBuffer);
      } else {
        this.logger.warn(`Failed to fetch logo: ${response.statusText}`);
      }
    } catch (err) {
      this.logger.error('Failed to fetch logo', err);
    }

    // 5. Generate PDF
    const pdfBuffer = await this.createPdfBuffer(student, approvedRequests, qrBuffer, verificationToken, logoBuffer);

    // 5. Upload to S3
    const fileName = `certificate_${student.id.substring(0, 8)}_${Date.now()}.pdf`;
    const uploadResult = await this.filesService.uploadBuffer(pdfBuffer, fileName, 'application/pdf');

    // 6. Save Certificate Record
    const certificate = await this.prisma.certificate.upsert({
      where: { studentId_academicSessionId: { studentId, academicSessionId } },
      create: {
        studentId,
        academicSessionId,
        verificationToken,
        fileUrl: uploadResult.fileUrl,
      },
      update: {
        verificationToken,
        fileUrl: uploadResult.fileUrl,
        issuedAt: new Date(),
      },
    });

    return certificate;
  }

  private createPdfBuffer(student: any, approvedRequests: any[], qrBuffer: Buffer, token: string, logoBuffer?: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0, layout: 'landscape' });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const W = doc.page.width;
      const H = doc.page.height;
      const margin = 36;

      const NAVY = '#000080';
      const LIGHT_NAVY = '#E6E6F2';
      const WHITE = '#FFFFFF';
      const DARK = '#111111';
      const GREY = '#555555';

      // Green corner triangles
      const cs = 90;
      doc.save().polygon([0, 0], [cs, 0], [0, cs]).fill(NAVY).restore();
      doc.save().polygon([W, 0], [W - cs, 0], [W, cs]).fill(NAVY).restore();
      doc.save().polygon([0, H], [cs, H], [0, H - cs]).fill(NAVY).restore();
      doc.save().polygon([W, H], [W - cs, H], [W, H - cs]).fill(NAVY).restore();

      // Outer border
      doc.rect(margin, margin, W - margin * 2, H - margin * 2)
        .lineWidth(2).strokeColor(NAVY).stroke();

      // Header band
      const headerH = 95;
      doc.rect(margin, margin, W - margin * 2, headerH).fill(WHITE);
      
      if (logoBuffer) {
        doc.image(logoBuffer, margin + 20, margin + 15, { width: 60 });
      }

      doc.fillColor(DARK).fontSize(18).font('Helvetica-Bold')
        .text('ADMIRALTY UNIVERSITY OF NIGERIA', margin, margin + 14, { align: 'center', width: W - margin * 2 });
      doc.fillColor(NAVY).fontSize(12).font('Helvetica-Bold')
        .text('WEB-CLEARANCE SYSTEM', margin, margin + 36, { align: 'center', width: W - margin * 2 });
      doc.fillColor(GREY).fontSize(9).font('Helvetica')
        .text('Student Clearance Management Platform', margin, margin + 52, { align: 'center', width: W - margin * 2 });
      doc.fillColor(GREY).fontSize(8)
        .text('Official Clearance Document – Not Valid Without QR Verification', margin, margin + 68, { align: 'center', width: W - margin * 2 });

      // Divider under header
      doc.rect(margin, margin + headerH, W - margin * 2, 3).fill(NAVY);

      // Title row
      const titleY = margin + headerH + 14;
      doc.rect(margin + 12, titleY + 9, 55, 3).fill(NAVY);
      doc.rect(margin + 12, titleY + 15, 55, 1).fill(NAVY);
      doc.fillColor(DARK).fontSize(18).font('Helvetica-Bold')
        .text('STUDENT CLEARANCE CERTIFICATE', margin, titleY, { align: 'center', width: W - margin * 2 });
      doc.rect(W - margin - 67, titleY + 9, 55, 3).fill(NAVY);
      doc.rect(W - margin - 67, titleY + 15, 55, 1).fill(NAVY);

      // Central pip bar
      const pipY = titleY + 30;
      [-4, 0, 4].forEach((offset) => {
        doc.rect(W / 2 + offset - 2, pipY, 4, 10).fill(NAVY);
      });

      // Two-column layout
      const bodyTop = pipY + 20;
      const colGap = 18;
      const colLeft = margin + 12;
      const colW = (W - margin * 2 - colGap) / 2;
      const colRight = colLeft + colW + colGap;

      // ─── LEFT COLUMN ────────────────────────────────────────────────────
      let ly = bodyTop;

      // Student Information section
      doc.rect(colLeft, ly, 5, 14).fill(NAVY);
      doc.fillColor(NAVY).fontSize(10).font('Helvetica-Bold')
        .text('Student Information', colLeft + 10, ly + 1);
      ly += 22;
      doc.rect(colLeft, ly, colW, 0.5).fill('#CCCCCC');
      ly += 8;

      const valueX = colLeft + 130;
      const rowH = 18;

      [['Full Name', student.name || '—'], ['Email', student.email], ['Student ID', student.id.substring(0, 20) + '…']].forEach(([label, value]) => {
        doc.rect(colLeft + 2, ly + 4, 3, 10).fill(NAVY);
        doc.fillColor(GREY).fontSize(8).font('Helvetica-Bold').text(label, colLeft + 6, ly + 4);
        doc.fillColor(DARK).fontSize(8).font('Helvetica').text(value, valueX, ly + 4, { width: colW - (valueX - colLeft), ellipsis: true });
        ly += rowH;
      });

      ly += 10;

      // Clearance Summary section
      doc.rect(colLeft, ly, 5, 14).fill(NAVY);
      doc.fillColor(NAVY).fontSize(10).font('Helvetica-Bold')
        .text('Clearance Summary', colLeft + 10, ly + 1);
      ly += 22;
      doc.rect(colLeft, ly, colW, 0.5).fill('#CCCCCC');
      ly += 8;

      approvedRequests.forEach((req) => {
        doc.rect(colLeft + 2, ly + 2, 42, 13).fill(NAVY);
        doc.fillColor(WHITE).fontSize(7).font('Helvetica-Bold')
          .text('CLEARED', colLeft + 2, ly + 5, { width: 42, align: 'center' });
        doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold')
          .text(req.department.name, colLeft + 50, ly + 3, { width: colW - 54, ellipsis: true });
        doc.fillColor(GREY).fontSize(7).font('Helvetica')
          .text('Status: Approved', colLeft + 50, ly + 13, { width: colW - 54 });
        ly += 30;
      });

      // Final clearance statement
      ly += 4;
      doc.rect(colLeft, ly, 5, 14).fill(NAVY);
      doc.fillColor(NAVY).fontSize(10).font('Helvetica-Bold')
        .text('Final Clearance Statement', colLeft + 10, ly + 1);
      ly += 20;
      doc.fillColor(GREY).fontSize(8).font('Helvetica')
        .text(
          'This student has successfully completed all required clearance procedures and is hereby cleared by all listed departments.',
          colLeft, ly, { width: colW },
        );

      // ─── RIGHT COLUMN ───────────────────────────────────────────────────
      let ry = bodyTop;
      const issuedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

      // Student details card
      doc.rect(colRight, ry, colW, 80).fill(LIGHT_NAVY);
      doc.fillColor(NAVY).fontSize(10).font('Helvetica-Bold')
        .text('Student Details', colRight + 10, ry + 8);
      doc.rect(colRight + 10, ry + 22, colW - 20, 0.5).fill(NAVY);

      let rly = ry + 28;
      [['Date Issued', issuedDate], ['Departments', `${approvedRequests.length} Department(s) Cleared`]].forEach(([label, value]) => {
        doc.fillColor(GREY).fontSize(8).font('Helvetica-Bold').text(label, colRight + 10, rly);
        doc.fillColor(DARK).fontSize(8).font('Helvetica').text(value, colRight + 105, rly, { width: colW - 115 });
        rly += 16;
      });
      ry += 94;

      // Unique Certificate dashed box
      doc.rect(colRight, ry, colW, 52)
        .lineWidth(1).dash(4, { space: 3 }).strokeColor(NAVY).stroke();
      doc.undash();
      doc.fillColor(NAVY).fontSize(9).font('Helvetica-Bold')
        .text('Unique Certificate', colRight + 8, ry + 8);
      doc.fillColor(GREY).fontSize(7.5).font('Helvetica')
        .text(
          'This certificate is digitally verified. Scan the QR code to confirm authenticity and view student records.',
          colRight + 8, ry + 22, { width: colW - 16 },
        );
      ry += 64;

      // QR Code
      const qrSize = 95;
      const qrX = colRight + colW - qrSize - 4;
      const qrY = H - margin - qrSize - 40;
      doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold')
        .text('Unique Certificate ID', colRight, qrY - 16, { width: colW });
      doc.image(qrBuffer, qrX, qrY, { width: qrSize });
      doc.fillColor(GREY).fontSize(6.5).font('Helvetica')
        .text(token.substring(0, 24) + '…', qrX, qrY + qrSize + 4, { width: qrSize, align: 'center' });
      doc.fillColor(GREY).fontSize(7).font('Helvetica')
        .text(`Date generated: ${issuedDate}`, qrX, qrY + qrSize + 16, { width: qrSize, align: 'center' });

      // Footer
      const footerY = H - margin - 20;
      doc.rect(margin, footerY, W - margin * 2, 0.5).fill(NAVY);
      doc.fillColor(GREY).fontSize(7).font('Helvetica')
        .text(
          'This is a computer-generated document and is valid without a physical signature.',
          margin, footerY + 6, { align: 'center', width: W - margin * 2 },
        );

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

  async getMyCertificate(studentId: string, academicSessionId: string) {
    let certificate = await this.prisma.certificate.findUnique({
      where: { studentId_academicSessionId: { studentId, academicSessionId } },
    });

    if (!certificate) {
      // Check if they are eligible to have one (maybe generation failed previously)
      const student = await this.prisma.user.findUnique({
        where: { id: studentId },
        include: { clearanceRequests: { where: { academicSessionId } } },
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
          certificate = await this.generateCertificate(studentId, academicSessionId);
          return certificate;
        }
      }

      throw new NotFoundException('Certificate not found. You may not have completed all clearances yet.');
    }

    return certificate;
  }
}
