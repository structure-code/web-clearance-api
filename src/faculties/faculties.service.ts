import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFacultyDto } from './dto/create-faculty.dto';
import { UpdateFacultyDto } from './dto/update-faculty.dto';
import { AssignFacultyOfficerDto } from './dto/assign-faculty-officer.dto';
import { Faculty, Role } from '@prisma/client';

@Injectable()
export class FacultiesService {
  constructor(private prisma: PrismaService) { }

  async create(createFacultyDto: CreateFacultyDto): Promise<Faculty> {
    return this.prisma.faculty.create({
      data: createFacultyDto,
    });
  }

  async findAll() {
    return this.prisma.faculty.findMany({
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });
  }

  async findAllActive() {
    return this.prisma.faculty.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        requiresDocument: true,
        requiredDocumentDescription: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const faculty = await this.prisma.faculty.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        departments: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!faculty) {
      throw new NotFoundException(`Faculty with ID ${id} not found`);
    }

    return faculty;
  }

  async update(id: string, updateFacultyDto: UpdateFacultyDto): Promise<Faculty> {
    return this.prisma.faculty.update({
      where: { id },
      data: updateFacultyDto,
    });
  }

  async remove(id: string): Promise<Faculty> {
    const faculty = await this.prisma.faculty.findUnique({
      where: { id },
      include: { 
        _count: { select: { users: true, departments: true } } 
      },
    });

    if (!faculty) {
      throw new NotFoundException(`Faculty with ID ${id} not found`);
    }

    if (faculty._count.users > 0) {
      throw new BadRequestException('Cannot delete faculty because users are assigned to it. Deactivate or remove users first.');
    }

    if (faculty._count.departments > 0) {
      throw new BadRequestException('Cannot delete faculty because departments are assigned to it.');
    }

    return this.prisma.faculty.delete({
      where: { id },
    });
  }

  async assignOfficer(facultyId: string, assignFacultyOfficerDto: AssignFacultyOfficerDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: assignFacultyOfficerDto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${assignFacultyOfficerDto.userId} not found`);
    }

    if (user.role !== Role.FACULTY_OFFICER) {
      throw new BadRequestException('Only FACULTY OFFICER can be assigned via this endpoint');
    }

    return this.prisma.user.update({
      where: { id: assignFacultyOfficerDto.userId },
      data: { facultyId },
    });
  }
}
