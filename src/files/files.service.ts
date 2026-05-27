import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const awsConfig = this.configService.get('aws');
    this.bucketName = awsConfig.s3BucketName;

    this.s3Client = new S3Client({
      region: awsConfig.region,
      credentials: {
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey,
      },
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<{ fileUrl: string; fileName: string; fileType: string; fileSize: number }> {
    const fileExtension = path.extname(file.originalname);
    const uniqueFileName = `${uuidv4()}${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: uniqueFileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      // ACL: 'public-read', // Ensure bucket policies allow public read if needed, or remove ACL if not needed
    });

    try {
      await this.s3Client.send(command);
      
      const region = this.configService.get('aws.region');
      const fileUrl = `https://${this.bucketName}.s3.${region}.amazonaws.com/${uniqueFileName}`;

      return {
        fileUrl,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
      };
    } catch (error) {
      this.logger.error('Error uploading file to S3', error);
      throw new InternalServerErrorException('Failed to upload file to S3');
    }
  }
}
