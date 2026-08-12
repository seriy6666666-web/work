import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

/** Значения из репозитория и примеров — в рабочем окружении их быть не должно. */
const KNOWN_WEAK = new Set([
  'dev-secret-change-me',
  'belmy_dev_password',
  'secret',
  'changeme',
  'password',
  'postgres',
]);

const MIN_SECRET_LENGTH = 32;

/**
 * SEED_DEMO_DATA=true помечает окружение как демонстрационное: там заводятся
 * сотрудники с паролем password123, поэтому слабые секреты ничего не ухудшают.
 * Во всех остальных окружениях слабый JWT_SECRET — причина не запускаться:
 * зная его, кто угодно подпишет себе токен администратора.
 */
function assertSecretsAreSafe() {
  const isDemo = process.env.SEED_DEMO_DATA === 'true';
  const secret = process.env.JWT_SECRET;
  const problems: string[] = [];

  if (!secret) {
    problems.push('JWT_SECRET не задан');
  } else if (KNOWN_WEAK.has(secret)) {
    problems.push('JWT_SECRET равен значению из примеров — его знает любой, кто видел репозиторий');
  } else if (secret.length < MIN_SECRET_LENGTH) {
    problems.push(`JWT_SECRET короче ${MIN_SECRET_LENGTH} символов (сейчас ${secret.length})`);
  }

  const dbPassword = process.env.DATABASE_URL?.match(/^postgresql:\/\/[^:]+:([^@]*)@/)?.[1];
  if (dbPassword && KNOWN_WEAK.has(decodeURIComponent(dbPassword))) {
    problems.push('пароль PostgreSQL в DATABASE_URL равен значению из примеров');
  }

  if (problems.length === 0) return;

  const list = problems.map((p) => `  - ${p}`).join('\n');
  if (isDemo) {
    console.warn(
      `\nВНИМАНИЕ, небезопасная конфигурация (допущена, т.к. SEED_DEMO_DATA=true):\n${list}\n` +
        'Для рабочего окружения задайте собственные значения.\n',
    );
    return;
  }

  throw new Error(
    `\nЗапуск остановлен — небезопасная конфигурация:\n${list}\n\n` +
      'Задайте свои значения в .env (см. .env.example). Сгенерировать секрет:\n' +
      '  Linux/macOS:  openssl rand -base64 48\n' +
      '  Windows:      powershell -c "[Convert]::ToBase64String((1..48|%{Get-Random -Max 256}))"\n\n' +
      'Если это демо-стенд и слабые секреты допустимы — выставьте SEED_DEMO_DATA=true.\n',
  );
}

async function bootstrap() {
  assertSecretsAreSafe();

  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
