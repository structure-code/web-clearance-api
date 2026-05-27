import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend: Resend;
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('resend.apiKey');
    this.resend = new Resend(apiKey);
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const emailFrom = this.configService.get<string>('emailFrom')!;
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    
    try {
      const { data, error } = await this.resend.emails.send({
        from: emailFrom,
        to: [to],
        subject: 'Password Reset Request',
        html: `<p>You requested a password reset. Click the link below to reset your password:</p><p><a href="${resetUrl}">Reset Password</a></p>`,
      });

      if (error) {
        this.logger.error('Failed to send password reset email', error);
        throw new Error('Failed to send password reset email');
      }

      this.logger.log(`Password reset email sent to ${to}`);
      return data;
    } catch (error) {
      this.logger.error('Error sending password reset email', error);
      throw error;
    }
  }

  async sendVerificationEmail(to: string, token: string) {
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const emailFrom = this.configService.get<string>('emailFrom')!;
    const verifyUrl = `${frontendUrl}/api/v1/auth/verify-email?token=${token}`;
    
    try {
      const { data, error } = await this.resend.emails.send({
        from: emailFrom,
        to: [to],
        subject: 'Verify your Email',
        html: `<p>Welcome! Please verify your email by clicking the link below:</p><p><a href="${verifyUrl}">Verify Email</a></p>`,
      });

      if (error) {
        this.logger.error('Failed to send verification email', error);
        throw new Error('Failed to send verification email');
      }

      this.logger.log(`Verification email sent to ${to}`);
      return data;
    } catch (error) {
      this.logger.error('Error sending verification email', error);
      throw error;
    }
  }
  async sendEmail(to: string, subject: string, html: string) {
    const emailFrom = this.configService.get<string>('emailFrom')!;
    try {
      const { data, error } = await this.resend.emails.send({
        from: emailFrom,
        to: [to],
        subject,
        html,
      });

      if (error) {
        this.logger.error(`Failed to send email to ${to}`, error);
        throw new Error('Failed to send email');
      }

      this.logger.log(`Email sent to ${to}: ${subject}`);
      return data;
    } catch (error) {
      this.logger.error(`Error sending email to ${to}`, error);
      throw error;
    }
  }
}
