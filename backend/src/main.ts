import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ContextInterceptor } from './common/interceptors/context.interceptor'; // ← add this import

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // (Optional but useful if behind proxy/load balancer)
  app.set('trust proxy', 1);

  // Enable CORS
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  // Serve static files
  app.useStaticAssets(join(process.cwd(), 'uploads', 'certificates'), {
    prefix: '/tankcertificate/uploads/certificates/',
  });
  app.useStaticAssets(join(process.cwd(), 'uploads', 'reports'), {
    prefix: '/tankcertificate/uploads/reports/',
  });
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // 🔑 Register the context interceptor globally (required for audit logs)
  app.useGlobalInterceptors(new ContextInterceptor());

await app.listen(8000, '0.0.0.0');
}
bootstrap();
