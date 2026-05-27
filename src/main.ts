import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { apiReference } from '@scalar/nestjs-api-reference';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const config = new DocumentBuilder()
    .setTitle('Web Clearance API')
    .setDescription('The Web Clearance API description')
    .setVersion('1.0')
    .build();
  
  // Set global prefix so Swagger picks it up
  app.setGlobalPrefix('api/v1');

  const document = SwaggerModule.createDocument(app, config);

  // Enable cookie parser
  app.use(cookieParser());

  const configService = app.get(ConfigService);
  const frontendUrl = configService.get<string>('frontendUrl');

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  // Enable global validation pipe
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // Set up standard Swagger UI (optional, but good for testing)
  // SwaggerModule.setup('api/swagger', app, document);

  // Set up Scalar UI
  app.use(
    '/api/docs',
    apiReference({
      spec: {
        content: document,
      },
      theme: 'default',
    }),
  );

  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger UI is available at: http://localhost:${port}/api/swagger`);
  logger.log(`Scalar UI is available at: http://localhost:${port}/api/docs`);
}
bootstrap();

