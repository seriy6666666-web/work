import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './jwt.strategy';

/**
 * Сколько неудач подряд по одной учётной записи считаем подбором.
 *
 * Десять — с запасом на живого человека: перепутанная раскладка, залипший
 * Caps Lock, пара попыток вспомнить пароль. Подбору же десяток попыток в
 * пять минут не даёт ничего.
 */
export const MAX_FAILED_LOGINS = 10;

/**
 * На сколько блокируем вход. Пять минут: подбор становится бессмысленным
 * (12 попыток в час вместо тысяч), а человек в цеху успевает дойти до
 * начальника участка или просто подождать, не срывая смену.
 */
export const LOCKOUT_MINUTES = 5;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Вход с защитой от подбора пароля по конкретной учётной записи.
   *
   * Общий ограничитель частоты стоит на 300 попыток в минуту с одного адреса —
   * порог высокий намеренно, потому что вся смена заходит через один заводской
   * шлюз, и более строгий лимит отрезал бы людей на старте смены. Подбор к одной
   * учётной записи в этот порог укладывался целиком, поэтому неудачи считаем
   * отдельно по каждому человеку.
   *
   * О блокировке говорим прямо, с оставшимся временем. Это выдаёт, что такая
   * учётная запись существует, — но логины сотрудников и так известны всей смене,
   * а рабочий, который видит «неверный пароль» на верном пароле, пойдёт не ждать,
   * а искать начальника.
   */
  async login(username: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(this.lockMessage(user.lockedUntil));
    }

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      const locked = await this.registerFailedAttempt(user.id, user.failedLoginCount);
      if (locked) {
        throw new UnauthorizedException(this.lockMessage(locked));
      }
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    if (user.archivedAt) {
      throw new UnauthorizedException('Учётная запись в архиве — обратитесь к администратору');
    }

    // Пароль верный — счётчик обнуляем, иначе редкие опечатки за неделю
    // накопились бы в блокировку на ровном месте.
    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      siteId: user.siteId,
    };
    return { accessToken: await this.jwtService.signAsync(payload) };
  }

  /**
   * Записать неудачную попытку. Возвращает время окончания блокировки, если
   * этой попыткой лимит исчерпан, иначе null.
   *
   * При блокировке счётчик сбрасываем: после того как срок вышел, у человека
   * снова полные десять попыток, а не одна.
   */
  private async registerFailedAttempt(userId: string, previousCount: number): Promise<Date | null> {
    const attempts = previousCount + 1;
    if (attempts < MAX_FAILED_LOGINS) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { failedLoginCount: attempts },
      });
      return null;
    }

    const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil },
    });
    return lockedUntil;
  }

  private lockMessage(lockedUntil: Date): string {
    const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000));
    return (
      `Слишком много неудачных попыток. Вход заблокирован ещё на ${minutes} мин. ` +
      'Если пароль забыт, новый задаёт администратор — блокировка при этом снимается.'
    );
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      siteId: user.siteId,
    };
  }
}
