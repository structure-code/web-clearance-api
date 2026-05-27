import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async createNotification(
    userId: string,
    title: string,
    message: string,
    type: NotificationType = NotificationType.INFO,
    sendEmail: boolean = true,
  ) {
    // 1. Create in-app notification
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
      },
    });

    // 2. Send Email if requested
    if (sendEmail) {
      try {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user && user.email) {
          const html = `
            <h2>${title}</h2>
            <p>${message}</p>
            <p>Log in to your dashboard to view more details.</p>
          `;
          await this.mailService.sendEmail(user.email, title, html);
        }
      } catch (error) {
        this.logger.error(`Failed to send email notification to user ${userId}`, error);
        // Do not throw, because we still want the in-app notification to succeed
      }
    }

    return notification;
  }

  async findAllForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(id: string, userId: string) {
    // Ensure the notification belongs to the user
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (notification && notification.userId === userId) {
      return this.prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });
    }

    return null;
  }
}
