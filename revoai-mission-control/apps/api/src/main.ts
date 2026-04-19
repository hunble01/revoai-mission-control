import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { AllExceptionsFilter } from './common/http-exception.filter';

function initSentry() {
  const dsn = (process.env.SENTRY_DSN || '').trim();
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    release: process.env.SENTRY_RELEASE || undefined,
  });
}

const DEV_DEFAULTS = new Set(['change-me', '<generate>', 'revoai', 'revoai-linkedin-dev-secret']);

function assertSecrets() {
  if (process.env.NODE_ENV !== 'production') return;
  const required = ['SESSION_SECRET', 'PASSWORD_SALT', 'SECRET_KEY', 'ADMIN_TOKEN'];
  const providerConditional: Record<string, string> = {
    LINKEDIN_TOKEN_SECRET: 'LINKEDIN_STUB_MODE',
    FACEBOOK_TOKEN_SECRET: 'FACEBOOK_STUB_MODE',
  };
  const missing: string[] = [];
  for (const k of required) {
    const v = (process.env[k] || '').trim();
    if (!v || DEV_DEFAULTS.has(v)) missing.push(k);
  }
  for (const [k, gate] of Object.entries(providerConditional)) {
    const stub = (process.env[gate] ?? '1') !== '0';
    if (stub) continue;
    const v = (process.env[k] || '').trim();
    if (!v || DEV_DEFAULTS.has(v)) missing.push(k);
  }
  if (missing.length) {
    const msg = `Refusing to start: required secrets missing or using dev defaults: ${missing.join(', ')}`;
    console.error(msg);
    throw new Error(msg);
  }
}

type RateBucket = { count: number; windowStart: number };
const rateMap = new Map<string, RateBucket>();

function rateLimit(req: any, res: any, next: any) {
  const method = req.method.toUpperCase();
  const path: string = String(req.path || '');
  const isAuthSensitive = /^\/api\/auth\/(login|bootstrap)/.test(path);
  if (!isAuthSensitive && !['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return next();

  const key = `${req.ip}:${path}`;
  const now = Date.now();
  const windowMs = 60_000;
  const max = isAuthSensitive ? 10 : 120;
  const bucket = rateMap.get(key);
  if (!bucket || now - bucket.windowStart > windowMs) {
    rateMap.set(key, { count: 1, windowStart: now });
    return next();
  }
  bucket.count += 1;
  if (bucket.count > max) {
    const retryAfterSec = Math.ceil((windowMs - (now - bucket.windowStart)) / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      ok: false,
      error: { message: 'Rate limit exceeded', status: 429, retryAfterSec },
    });
  }
  return next();
}

async function bootstrap() {
  assertSecrets();
  initSentry();
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: true,
      credentials: true,
    },
  });
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: false,
    }),
  );
  app.use(rateLimit);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3001);
}
bootstrap();
