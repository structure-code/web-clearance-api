import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { AssignOfficerDto } from './dto/assign-officer.dto';
import { Department, Role } from '@prisma/client';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) { }

  async create(createDepartmentDto: CreateDepartmentDto): Promise<Department> {
    return this.prisma.department.create({
      data: createDepartmentDto,
    });
  }

  async findAll() {
    return this.prisma.department.findMany({
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
    return this.prisma.department.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
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
      },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }

    return department;
  }

  async update(id: string, updateDepartmentDto: UpdateDepartmentDto): Promise<Department> {
    return this.prisma.department.update({
      where: { id },
      data: updateDepartmentDto,
    });
  }

  async remove(id: string): Promise<Department> {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }

    if (department._count.users > 0) {
      throw new BadRequestException('Cannot delete department because users are assigned to it. Deactivate or remove users first.');
    }

    return this.prisma.department.delete({
      where: { id },
    });
  }

  async assignOfficer(departmentId: string, assignOfficerDto: AssignOfficerDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: assignOfficerDto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${assignOfficerDto.userId} not found`);
    }

    if (user.role !== Role.DEPARTMENT_OFFICER) {
      throw new BadRequestException('Only DEPARTMENT OFFICER can be assigned via this endpoint');
    }

    return this.prisma.user.update({
      where: { id: assignOfficerDto.userId },
      data: { departmentId },
    });
  }
}
