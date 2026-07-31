import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User, Role } from '@prisma/client';

import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    
    let facultyId = createUserDto.facultyId;
    if (createUserDto.departmentId && !facultyId) {
      const dept = await this.prisma.department.findUnique({ where: { id: createUserDto.departmentId } });
      if (!dept) throw new BadRequestException('Department not found');
      facultyId = dept.facultyId || undefined;
    }

    return this.prisma.user.create({
      data: {
        ...createUserDto,
        facultyId,
        password: hashedPassword,
        isEmailVerified: true, // Auto-verify users created by Admin
      },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        departmentId: true,
        facultyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const data: Prisma.UserUpdateInput = { ...updateUserDto };
    
    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async updateResetToken(id: string, resetToken: string | null, resetTokenExpiry: Date | null): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { resetToken, resetTokenExpiry },
    });
  }

  async findByResetToken(resetToken: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { resetToken },
    });
  }

  async findByEmailVerifyToken(emailVerifyToken: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { emailVerifyToken },
    });
  }
}
