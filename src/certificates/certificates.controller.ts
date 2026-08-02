import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@prisma/client';

@ApiTags('Certificates')
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get current user certificate for an academic session' })
  @ApiQuery({ name: 'academicSessionId', required: true })
  getMyCertificate(@CurrentUser() user: User, @Query('academicSessionId') academicSessionId?: string) {
    if (!academicSessionId) throw new BadRequestException('academicSessionId is required');
    return this.certificatesService.getMyCertificate(user.id, academicSessionId);
  }

  @Get('verify/:token')
  @ApiOperation({ summary: 'Verify a certificate by token (Public endpoint)' })
  @ApiParam({ name: 'token', required: true })
  verifyCertificate(@Param('token') token: string) {
    return this.certificatesService.verifyCertificate(token);
  }
}
