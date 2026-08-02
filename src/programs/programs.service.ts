import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { Program } from '@prisma/client';

@Injectable()
export class ProgramsService {
  constructor(private prisma: PrismaService) {}

  async create(createProgramDto: CreateProgramDto): Promise<Program> {
    return this.prisma.program.create({
      data: createProgramDto,
    });
  }

  async findAll() {
    return this.prisma.program.findMany({
      include: {
        faculty: {
          select: { id: true, name: true }
        }
      },
    });
  }

  async findAllActive() {
    return this.prisma.program.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        faculty: { select: { id: true, name: true } }
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const program = await this.prisma.program.findUnique({
      where: { id },
      include: {
        faculty: true,
      },
    });

    if (!program) {
      throw new NotFoundException(`Program with ID ${id} not found`);
    }

    return program;
  }

  async update(id: string, updateProgramDto: UpdateProgramDto): Promise<Program> {
    return this.prisma.program.update({
      where: { id },
      data: updateProgramDto,
    });
  }

  async remove(id: string): Promise<Program> {
    const program = await this.prisma.program.findUnique({
      where: { id },
      include: { 
        _count: { select: { users: true } } 
      },
    });

    if (!program) {
      throw new NotFoundException(`Program with ID ${id} not found`);
    }

    if (program._count.users > 0) {
      throw new BadRequestException('Cannot delete program because users are assigned to it.');
    }

    return this.prisma.program.delete({
      where: { id },
    });
  }
}