import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client';
import { Role } from '../src/generated/prisma/enums';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const SITES = ['Сборка', 'Формовка', 'Упаковка'];

// Core login accounts (one per role) plus extra workers so the boards look alive.
const SEED_USERS: { username: string; fullName: string; role: Role; site?: string }[] = [
  { username: 'admin', fullName: 'Админ Тестовый', role: Role.ADMIN },
  { username: 'planner', fullName: 'Планировщик Тестовый', role: Role.PLANNER },
  { username: 'production_head', fullName: 'Начальник Производства Тестовый', role: Role.PRODUCTION_HEAD },
  { username: 'site_lead', fullName: 'Начальник Участка Тестовый', role: Role.SITE_LEAD, site: 'Сборка' },
  { username: 'worker', fullName: 'Сотрудник Тестовый', role: Role.WORKER, site: 'Сборка' },
  { username: 'ivanov', fullName: 'Иванов Иван', role: Role.WORKER, site: 'Сборка' },
  { username: 'petrov', fullName: 'Петров Пётр', role: Role.WORKER, site: 'Сборка' },
  { username: 'sidorov', fullName: 'Сидоров Сидор', role: Role.WORKER, site: 'Сборка' },
  { username: 'kuznetsov', fullName: 'Кузнецов Алексей', role: Role.WORKER, site: 'Формовка' },
  { username: 'smirnov', fullName: 'Смирнов Дмитрий', role: Role.WORKER, site: 'Упаковка' },
];

const SKILLS = ['Сборка АКБ', 'Пайка', 'Тестирование', 'Контроль качества', 'Упаковка'];

// worker username -> skills they are certified for
const COMPETENCIES: Record<string, string[]> = {
  worker: ['Сборка АКБ', 'Пайка'],
  ivanov: ['Сборка АКБ', 'Тестирование'],
  petrov: ['Пайка', 'Контроль качества'],
  sidorov: ['Сборка АКБ', 'Упаковка'],
  kuznetsov: ['Сборка АКБ'],
  smirnov: ['Упаковка'],
};

function at(daysAgo: number, hour = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// UTC-midnight date for `daysFromToday`, keyed off LOCAL calendar components so
// it matches how the frontend computes the week (local Monday -> YYYY-MM-DD).
function dayUtc(daysFromToday: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return new Date(`${y}-${m}-${day}T00:00:00.000Z`);
}

function mondayOffset(): number {
  // Days to subtract from today to reach Monday of the current week.
  return (new Date().getDay() + 6) % 7;
}

async function main() {
  // --- Sites (idempotent) ---
  const siteByName = new Map<string, string>();
  for (const name of SITES) {
    const site = await prisma.site.upsert({ where: { name }, update: {}, create: { name } });
    siteByName.set(name, site.id);
  }

  // --- Users (idempotent) ---
  const passwordHash = await bcrypt.hash('password123', 10);
  const userByUsername = new Map<string, string>();
  for (const u of SEED_USERS) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        passwordHash,
        fullName: u.fullName,
        role: u.role,
        siteId: u.site ? siteByName.get(u.site) : null,
      },
    });
    userByUsername.set(u.username, user.id);
  }

  // --- Skills (idempotent) ---
  const skillByName = new Map<string, string>();
  for (const name of SKILLS) {
    const skill = await prisma.skill.upsert({ where: { name }, update: {}, create: { name } });
    skillByName.set(name, skill.id);
  }

  // Heavy demo content is seeded only once (skipped if orders already exist).
  if ((await prisma.order.count()) > 0) {
    console.log('Seed completed (demo content already present). Users:', SEED_USERS.map((u) => u.username).join(', '));
    return;
  }

  const assembly = siteByName.get('Сборка')!;
  const forming = siteByName.get('Формовка')!;

  // --- Competencies ---
  for (const [username, skills] of Object.entries(COMPETENCIES)) {
    for (const skillName of skills) {
      await prisma.competency.create({
        data: { userId: userByUsername.get(username)!, skillId: skillByName.get(skillName)! },
      });
    }
  }

  // --- Product routing template ---
  const product = await prisma.product.create({ data: { name: 'АКБ-48В' } });
  const routing = ['Сборка АКБ', 'Пайка', 'Тестирование'];
  for (let i = 0; i < routing.length; i++) {
    await prisma.productOperation.create({
      data: {
        productId: product.id,
        sequence: i,
        skillId: skillByName.get(routing[i])!,
        siteId: assembly,
      },
    });
  }

  // --- Orders + operations ---
  // Order A: fully completed (DONE), drives trend history + ranking.
  const orderA = await prisma.order.create({
    data: {
      name: 'Партия АКБ-48В (заказ #1024)',
      quantity: 100,
      dueDate: at(-6), // due in the future
      priority: 2,
      status: 'IN_PROGRESS',
      operations: {
        create: [
          { quantity: 100, siteId: assembly, skillId: skillByName.get('Сборка АКБ')! },
          { quantity: 100, siteId: assembly, skillId: skillByName.get('Пайка')! },
          { quantity: 100, siteId: assembly, skillId: skillByName.get('Тестирование')! },
        ],
      },
    },
    include: { operations: true },
  });

  // Order B: tight deadline, partially assigned (at-risk material for warnings).
  const orderB = await prisma.order.create({
    data: {
      name: 'Партия АКБ-24В (заказ #1025)',
      quantity: 60,
      dueDate: at(-1), // due very soon
      priority: 3,
      status: 'IN_PROGRESS',
      operations: {
        create: [{ quantity: 60, siteId: assembly, skillId: skillByName.get('Сборка АКБ')! }],
      },
    },
    include: { operations: true },
  });

  // Order C: created but not distributed yet (appears fresh on the board).
  await prisma.order.create({
    data: {
      name: 'Формовка пластин (заказ #1026)',
      quantity: 200,
      dueDate: at(-9),
      priority: 1,
      status: 'CREATED',
      operations: {
        create: [{ quantity: 200, siteId: forming, skillId: skillByName.get('Сборка АКБ')! }],
      },
    },
  });

  // --- Assignments + completion records (backdated for the trend curve) ---
  const assemblyWorkers = ['worker', 'ivanov', 'petrov', 'sidorov'];
  const opAssembleA = orderA.operations.find((o) => o.skillId === skillByName.get('Сборка АКБ'))!;
  const opSolderA = orderA.operations.find((o) => o.skillId === skillByName.get('Пайка'))!;
  const opTestA = orderA.operations.find((o) => o.skillId === skillByName.get('Тестирование'))!;
  const opB = orderB.operations[0];

  // Each tuple: [operationId, workerUsername, doneQuantity, defectQuantity, daysAgo]
  const work: [string, string, number, number, number][] = [
    [opAssembleA.id, 'worker', 30, 0, 8],
    [opAssembleA.id, 'ivanov', 30, 2, 7],
    [opAssembleA.id, 'petrov', 40, 0, 6],
    [opSolderA.id, 'worker', 50, 3, 5],
    [opSolderA.id, 'sidorov', 50, 0, 4],
    [opTestA.id, 'ivanov', 45, 0, 3],
    [opTestA.id, 'petrov', 40, 5, 2],
    [opB.id, 'worker', 25, 0, 1],
    [opB.id, 'sidorov', 20, 1, 0],
  ];

  for (const [operationId, username, done, defect, daysAgo] of work) {
    const assignment = await prisma.assignment.create({
      data: { operationId, userId: userByUsername.get(username)!, assignedQuantity: done + defect },
    });
    await prisma.completionRecord.create({
      data: {
        assignmentId: assignment.id,
        doneQuantity: done,
        defectQuantity: defect,
        doneFlag: true,
        recordedAt: at(daysAgo),
      },
    });
  }

  // --- Today's check-ins (so "на смене" is populated on the board) ---
  for (const username of ['worker', 'ivanov', 'petrov']) {
    await prisma.shift.create({
      data: { userId: userByUsername.get(username)!, checkInAt: at(0, 8) },
    });
  }

  // --- Equipment (varied statuses across sites) ---
  await prisma.equipment.createMany({
    data: [
      { name: 'Сборочная линия №1', status: 'OPERATIONAL', nextMaintenanceAt: at(-10), siteId: assembly },
      { name: 'Паяльная станция №2', status: 'MAINTENANCE', nextMaintenanceAt: at(-2), siteId: assembly },
      { name: 'Тестовый стенд №3', status: 'BROKEN', siteId: assembly },
      { name: 'Пресс гидравлический №4', status: 'OPERATIONAL', nextMaintenanceAt: at(-3), siteId: assembly },
      { name: 'Формовочный пресс', status: 'OPERATIONAL', nextMaintenanceAt: at(-20), siteId: forming },
    ],
  });

  // --- Materials (one below threshold for the low-stock alert) ---
  await prisma.material.createMany({
    data: [
      { name: 'Литиевые ячейки', unit: 'шт', quantity: 1500, lowStockThreshold: 500 },
      { name: 'Корпус АКБ', unit: 'шт', quantity: 80, lowStockThreshold: 100 }, // low
      { name: 'Припой', unit: 'кг', quantity: 12, lowStockThreshold: 5 },
      { name: 'Электролит', unit: 'л', quantity: 40, lowStockThreshold: 20 },
      { name: 'Клеммы', unit: 'шт', quantity: 300, lowStockThreshold: 200 },
    ],
  });

  // --- Planned shifts for the current week (Сборка) ---
  const monday = mondayOffset();
  const shiftPlan: [string, number, 'DAY' | 'NIGHT'][] = [
    ['worker', 0, 'DAY'],
    ['worker', 1, 'DAY'],
    ['worker', 2, 'NIGHT'],
    ['ivanov', 0, 'DAY'],
    ['ivanov', 1, 'NIGHT'],
    ['petrov', 2, 'DAY'],
    ['petrov', 3, 'DAY'],
    ['sidorov', 3, 'NIGHT'],
    ['sidorov', 4, 'DAY'],
  ];
  for (const [username, dayIdx, type] of shiftPlan) {
    await prisma.plannedShift.create({
      data: {
        userId: userByUsername.get(username)!,
        siteId: assembly,
        date: dayUtc(-monday + dayIdx),
        type,
      },
    });
  }

  console.log('Seed completed with demo content. Users:', SEED_USERS.map((u) => u.username).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
