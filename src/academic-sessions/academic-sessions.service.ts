import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AcademicSession } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAcademicSessionDto } from './dto/create-academic-session.dto';
import { UpdateAcademicSessionDto } from './dto/update-academic-session.dto';

@Injectable()
export class AcademicSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAcademicSessionDto): Promise<AcademicSession> {
    return this.prisma.academicSession.create({ data: dto });
  }

  async findAll() {
    return this.prisma.academicSession.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'desc' }] });
  }

  async findAllActive() {
    return this.prisma.academicSession.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'desc' },
    });
  }

  async findOne(id: string) {
    const session = await this.prisma.academicSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException(`Academic session with ID ${id} not found`);
    return session;
  }

  async update(id: string, dto: UpdateAcademicSessionDto): Promise<AcademicSession> {
    await this.findOne(id);
    return this.prisma.academicSession.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<AcademicSession> {
    const session = await this.prisma.academicSession.findUnique({
      where: { id },
      include: { _count: { select: { clearanceRequests: true, certificates: true } } },
    });
    if (!session) throw new NotFoundException(`Academic session with ID ${id} not found`);
    if (session._count.clearanceRequests > 0 || session._count.certificates > 0) {
      throw new BadRequestException('Cannot delete an academic session with clearance records or certificates. Deactivate it instead.');
    }
    return this.prisma.academicSession.delete({ where: { id } });
  }
}
