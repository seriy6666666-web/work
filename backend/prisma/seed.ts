import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client';
import { Role } from '../src/generated/prisma/enums';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const SEED_USERS: { username: string; fullName: string; role: Role }[] = [
  { username: 'admin', fullName: 'Админ Тестовый', role: Role.ADMIN },
  { username: 'planner', fullName: 'Планировщик Тестовый', role: Role.PLANNER },
  { username: 'production_head', fullName: 'Начальник Производства Тестовый', role: Role.PRODUCTION_HEAD },
  { username: 'site_lead', fullName: 'Начальник Участка Тестовый', role: Role.SITE_LEAD },
  { username: 'worker', fullName: 'Сотрудник Тестовый', role: Role.WORKER },
];

async function main() {
  const site = await prisma.site.upsert({
    where: { name: 'Сборка' },
    update: {},
    create: { name: 'Сборка' },
  });

  const passwordHash = await bcrypt.hash('password123', 10);

  for (const seedUser of SEED_USERS) {
    await prisma.user.upsert({
      where: { username: seedUser.username },
      update: {},
      create: {
        username: seedUser.username,
        passwordHash,
        fullName: seedUser.fullName,
        role: seedUser.role,
        siteId: seedUser.role === Role.SITE_LEAD || seedUser.role === Role.WORKER ? site.id : null,
      },
    });
  }

  console.log('Seed completed. Users:', SEED_USERS.map((u) => u.username).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
