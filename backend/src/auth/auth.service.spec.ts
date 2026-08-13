import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService, MAX_FAILED_LOGINS, LOCKOUT_MINUTES } from './auth.service';

/**
 * Блокировка за подбор — логика с состоянием: счётчик, срок, сброс. Такое легко
 * сломать соседней правкой и трудно заметить руками, поэтому закрепляем тестом.
 */

type StoredUser = {
  id: string;
  username: string;
  passwordHash: string;
  role: string;
  siteId: string | null;
  archivedAt: Date | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
};

function makeService(user: StoredUser | null) {
  const prisma = {
    user: {
      findUnique: jest.fn(async () => user),
      update: jest.fn(async ({ data }: { data: Partial<StoredUser> }) => {
        if (user) Object.assign(user, data);
        return user;
      }),
    },
  };
  const jwt = { signAsync: jest.fn(async () => 'token') };
  const service = new AuthService(prisma as never, jwt as never);
  return { service, prisma, jwt };
}

async function user(over: Partial<StoredUser> = {}): Promise<StoredUser> {
  return {
    id: 'u-1',
    username: 'ivanov',
    passwordHash: await bcrypt.hash('verniy-parol', 4),
    role: 'WORKER',
    siteId: 's-1',
    archivedAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    ...over,
  };
}

describe('вход: защита от подбора пароля', () => {
  it('считает неудачи и блокирует ровно на десятой', async () => {
    const u = await user();
    const { service } = makeService(u);

    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      await expect(service.login('ivanov', 'мимо')).rejects.toThrow('Неверный логин или пароль');
      expect(u.failedLoginCount).toBe(i);
      expect(u.lockedUntil).toBeNull();
    }

    await expect(service.login('ivanov', 'мимо')).rejects.toThrow(/заблокирован/i);
    expect(u.lockedUntil).toBeInstanceOf(Date);
    // Счётчик сброшен: после окончания срока у человека снова полные десять попыток.
    expect(u.failedLoginCount).toBe(0);
  });

  it('блокирует примерно на заявленное время', async () => {
    const u = await user({ failedLoginCount: MAX_FAILED_LOGINS - 1 });
    const { service } = makeService(u);

    const before = Date.now();
    await expect(service.login('ivanov', 'мимо')).rejects.toThrow(/заблокирован/i);

    const ms = u.lockedUntil!.getTime() - before;
    expect(ms).toBeGreaterThan((LOCKOUT_MINUTES - 1) * 60_000);
    expect(ms).toBeLessThanOrEqual(LOCKOUT_MINUTES * 60_000 + 1000);
  });

  it('пока блокировка держится, не пускает даже с верным паролем', async () => {
    const u = await user({ lockedUntil: new Date(Date.now() + 60_000) });
    const { service } = makeService(u);

    await expect(service.login('ivanov', 'verniy-parol')).rejects.toThrow(UnauthorizedException);
    await expect(service.login('ivanov', 'verniy-parol')).rejects.toThrow(/заблокирован/i);
  });

  it('после истечения срока верный пароль пускает и обнуляет счётчик', async () => {
    const u = await user({ lockedUntil: new Date(Date.now() - 1000), failedLoginCount: 3 });
    const { service } = makeService(u);

    await expect(service.login('ivanov', 'verniy-parol')).resolves.toEqual({ accessToken: 'token' });
    expect(u.failedLoginCount).toBe(0);
    expect(u.lockedUntil).toBeNull();
  });

  it('верный пароль обнуляет накопленные неудачи — опечатки не копятся в блокировку', async () => {
    const u = await user({ failedLoginCount: MAX_FAILED_LOGINS - 1 });
    const { service } = makeService(u);

    await expect(service.login('ivanov', 'verniy-parol')).resolves.toEqual({ accessToken: 'token' });
    expect(u.failedLoginCount).toBe(0);
  });

  it('несуществующий логин не трогает чужие счётчики и отвечает обычным отказом', async () => {
    const { service, prisma } = makeService(null);

    await expect(service.login('kogo-net', 'что угодно')).rejects.toThrow('Неверный логин или пароль');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('архивного не пускает, даже когда пароль верный', async () => {
    const u = await user({ archivedAt: new Date() });
    const { service } = makeService(u);

    await expect(service.login('ivanov', 'verniy-parol')).rejects.toThrow(/архиве/i);
  });
});
