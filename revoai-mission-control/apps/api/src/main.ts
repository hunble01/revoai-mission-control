import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/http-exception.filter';

const rateMap = new Map<string, number[]>();

function rateLimit(req: any, res: any, next: any) {
  const method = req.method.toUpperCase();
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return next();

  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  const windowMs = 60_000;
  const max = 120;
  const items = (rateMap.get(key) || []).filter((ts) => now - ts < windowMs);
  items.push(now);
  rateMap.set(key, items);

  if (items.length > max) {
    return res.status(429).json({ ok: false, error: { message: 'Rate limit exceeded', status: 429 } });
  }
  return next();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.use(rateLimit);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3001);
}
bootstrap();
