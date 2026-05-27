import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Get current user certificate' })
  getMyCertificate(@CurrentUser() user: User) {
    return this.certificatesService.getMyCertificate(user.id);
  }

  @Get('verify/:token')
  @ApiOperation({ summary: 'Verify a certificate by token (Public endpoint)' })
  @ApiParam({ name: 'token', required: true })
  verifyCertificate(@Param('token') token: string) {
    return this.certificatesService.verifyCertificate(token);
  }
}
