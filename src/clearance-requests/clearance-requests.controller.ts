import { Controller, Get, Post, Body, Patch, Param, UseGuards, Ip, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { ClearanceRequestsService } from './clearance-requests.service';
import { CreateClearanceRequestDto } from './dto/create-clearance-request.dto';
import { UpdateClearanceStatusDto } from './dto/update-clearance-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClearanceStatus, Role } from '@prisma/client';
import type { User } from '@prisma/client';

@ApiTags('Clearance Requests')
@Controller('clearance-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiCookieAuth()
export class ClearanceRequestsController {
  constructor(private readonly clearanceRequestsService: ClearanceRequestsService) {}

  @Post()
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Submit a clearance request (Student only)' })
  create(@CurrentUser() user: User, @Body() createDto: CreateClearanceRequestDto) {
    return this.clearanceRequestsService.create(user, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get clearance requests (Scope depends on role)' })
  findAll(@CurrentUser() user: User) {
    return this.clearanceRequestsService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific clearance request' })
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.clearanceRequestsService.findOne(id, user);
  }

  @Patch(':id/approve')
  @Roles(Role.DEPARTMENT_OFFICER, Role.ADMIN)
  @ApiOperation({ summary: 'Approve a clearance request (Officer/Admin)' })
  approve(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() updateDto: UpdateClearanceStatusDto,
    @Ip() ip?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.clearanceRequestsService.updateStatus(id, user, ClearanceStatus.APPROVED, updateDto, ip, userAgent);
  }

  @Patch(':id/reject')
  @Roles(Role.DEPARTMENT_OFFICER, Role.ADMIN)
  @ApiOperation({ summary: 'Reject a clearance request (Officer/Admin)' })
  reject(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() updateDto: UpdateClearanceStatusDto,
    @Ip() ip?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.clearanceRequestsService.updateStatus(id, user, ClearanceStatus.REJECTED, updateDto, ip, userAgent);
  }

  @Patch(':id/complete')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Force complete a clearance request (Admin only)' })
  forceComplete(@Param('id') id: string) {
    return this.clearanceRequestsService.adminUpdateStatus(id, ClearanceStatus.COMPLETED);
  }
}
