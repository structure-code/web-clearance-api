import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { AssignOfficerDto } from './dto/assign-officer.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Departments')
@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiCookieAuth()
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new department (Admin only)' })
  create(@Body() createDepartmentDto: CreateDepartmentDto) {
    return this.departmentsService.create(createDepartmentDto);
  }

  @Get('active')
  @Roles(Role.ADMIN, Role.DEPARTMENT_OFFICER, Role.STUDENT)
  @ApiOperation({ summary: 'Get all active departments (All authenticated users)' })
  findAllActive() {
    return this.departmentsService.findAllActive();
  }

  @Get()
  @ApiOperation({ summary: 'Get all departments (Admin only)' })
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific department (Admin only)' })
  findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a department (Admin only)' })
  update(@Param('id') id: string, @Body() updateDepartmentDto: UpdateDepartmentDto) {
    return this.departmentsService.update(id, updateDepartmentDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a department (Admin only)' })
  remove(@Param('id') id: string) {
    return this.departmentsService.remove(id);
  }

  @Post(':id/officers')
  @ApiOperation({ summary: 'Assign an officer to a department (Admin only)' })
  assignOfficer(@Param('id') id: string, @Body() assignOfficerDto: AssignOfficerDto) {
    return this.departmentsService.assignOfficer(id, assignOfficerDto);
  }
}
