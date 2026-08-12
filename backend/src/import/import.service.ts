import { BadRequestException, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../generated/prisma/enums';
import { cellNumber, cellText, findColumn, findHeaderRow, readWorkbook, type SheetRow } from './xlsx.util';

/** Смена 8 часов — норма выработки хранится в штуках за смену. */
const SHIFT_MINUTES = 480;

export interface ImportIssue {
  sheet: string;
  row: number;
  message: string;
}

export interface ImportCredential {
  fullName: string;
  username: string;
  password: string;
}

export interface ImportReport {
  dryRun: boolean;
  summary: { label: string; value: string | number }[];
  issues: ImportIssue[];
  /**
   * Логины и пароли созданных сотрудников — отдаются администратору один раз,
   * сразу после импорта: в базе лежит только хэш, восстановить пароль нельзя.
   */
  credentials?: ImportCredential[];
}

const RU_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};

/**
 * Пароль вида «belmy-7413»: его диктуют вслух и набирают на терминале в цеху,
 * поэтому важнее читаемость, чем экзотические символы. Меняется админом в любой момент.
 */
export function makePassword(): string {
  return `belmy-${randomInt(1000, 10000)}`;
}

/** «Головизин Сергей» → «golovizin.sergey» — логин для созданного сотрудника. */
function makeUsername(fullName: string): string {
  const translit = fullName
    .toLowerCase()
    .split('')
    .map((ch) => (RU_MAP[ch] !== undefined ? RU_MAP[ch] : /[a-z0-9\s]/.test(ch) ? ch : ''))
    .join('')
    .trim()
    .replace(/\s+/g, '.');
  return translit || 'user';
}

@Injectable()
export class ImportService {
  constructor(private prisma: PrismaService) {}

  // ==================================================================
  // Матрица компетенций
  // ==================================================================

  /**
   * Разбирает файл «Матрица компетенций»: листы «<Участок> навыки», шапка с
   * навыками и строки сотрудников с отметками 0/1. Листы «желания» игнорируем —
   * это пожелания по обучению, а не текущие навыки.
   */
  private parseCompetency(sheets: { name: string; rows: SheetRow[] }[]) {
    const skills = new Set<string>();
    // ФИО -> { site, skills }
    const people = new Map<string, { site: string | null; skills: Set<string> }>();
    const issues: ImportIssue[] = [];
    const usedSheets: string[] = [];

    // Сначала листы участков, затем сводный — чтобы участок не затирался сводом.
    const relevant = sheets.filter(
      (s) => s.name.toLowerCase().includes('навык') && !s.name.toLowerCase().includes('желани'),
    );
    const ordered = [
      ...relevant.filter((s) => !s.name.toLowerCase().trim().startsWith('свод')),
      ...relevant.filter((s) => s.name.toLowerCase().trim().startsWith('свод')),
    ];

    for (const sheet of ordered) {
      const headerIdx = findHeaderRow(sheet.rows, ['сотрудник']);
      if (headerIdx < 0) {
        issues.push({ sheet: sheet.name, row: 0, message: 'Не найдена шапка с колонкой «Сотрудник» — лист пропущен' });
        continue;
      }
      const header = sheet.rows[headerIdx];
      const skillCols: { index: number; name: string }[] = [];
      for (let c = 1; c < header.length; c++) {
        const name = cellText(header[c]);
        if (name) {
          skillCols.push({ index: c, name });
          skills.add(name);
        }
      }
      if (skillCols.length === 0) {
        issues.push({ sheet: sheet.name, row: headerIdx + 1, message: 'В шапке нет ни одного навыка — лист пропущен' });
        continue;
      }

      const isSummary = sheet.name.toLowerCase().trim().startsWith('свод');
      // \w не покрывает кириллицу, поэтому окончания слова «навыки/навыков»
      // вырезаем явным диапазоном — иначе в имени участка остаётся хвост.
      const site = isSummary
        ? null
        : sheet.name.replace(/навык[а-яё]*/gi, '').trim() || null;
      usedSheets.push(sheet.name);

      for (let r = headerIdx + 1; r < sheet.rows.length; r++) {
        const fullName = cellText(sheet.rows[r][0]);
        if (!fullName) continue;
        // В середине таблиц у Паши повторяется строка-шапка — пропускаем.
        if (fullName.toLowerCase() === 'сотрудник') continue;

        const marks = new Set<string>();
        for (const col of skillCols) {
          const v = cellNumber(sheet.rows[r][col.index]);
          if (v === 1) marks.add(col.name);
        }

        const existing = people.get(fullName);
        if (existing) {
          // Человек уже встречался (в своде или на другом листе) — дополняем.
          for (const m of marks) existing.skills.add(m);
          if (!existing.site && site) existing.site = site;
        } else {
          people.set(fullName, { site, skills: marks });
        }

        if (marks.size === 0 && !isSummary) {
          issues.push({ sheet: sheet.name, row: r + 1, message: `«${fullName}» — не отмечен ни один навык` });
        }
      }
    }

    return { skills: [...skills], people, issues, usedSheets };
  }

  async importCompetency(buffer: Buffer, dryRun: boolean): Promise<ImportReport> {
    const sheets = await readWorkbook(buffer);
    const parsed = this.parseCompetency(sheets);

    if (parsed.people.size === 0) {
      throw new BadRequestException(
        'В файле не найдено ни одного сотрудника. Ожидается лист вида «<Участок> навыки» с колонкой «Сотрудник».',
      );
    }

    const marksTotal = [...parsed.people.values()].reduce((s, p) => s + p.skills.size, 0);
    const summary: ImportReport['summary'] = [
      { label: 'Листов обработано', value: parsed.usedSheets.length },
      { label: 'Навыков', value: parsed.skills.length },
      { label: 'Сотрудников', value: parsed.people.size },
      { label: 'Отметок «владеет навыком»', value: marksTotal },
    ];

    if (dryRun) {
      return { dryRun: true, summary, issues: parsed.issues };
    }

    // --- Применение ---
    const credentials: ImportCredential[] = [];

    const skillIds = new Map<string, string>();
    for (const name of parsed.skills) {
      const skill = await this.prisma.skill.upsert({ where: { name }, update: {}, create: { name } });
      skillIds.set(name, skill.id);
    }

    const siteIds = new Map<string, string>();
    for (const p of parsed.people.values()) {
      if (p.site && !siteIds.has(p.site)) {
        const site = await this.prisma.site.upsert({
          where: { name: p.site },
          update: {},
          create: { name: p.site },
        });
        siteIds.set(p.site, site.id);
      }
    }

    let createdUsers = 0;
    let createdCompetencies = 0;
    for (const [fullName, info] of parsed.people) {
      let user = await this.prisma.user.findFirst({ where: { fullName } });
      if (!user) {
        // Логин может совпасть у тёзок — добавляем суффикс.
        const base = makeUsername(fullName);
        let username = base;
        for (let i = 2; await this.prisma.user.findUnique({ where: { username } }); i++) {
          username = `${base}${i}`;
        }
        // У каждого свой пароль: общий на всех означает, что все знают пароли друг друга.
        const password = makePassword();
        user = await this.prisma.user.create({
          data: {
            username,
            passwordHash: await bcrypt.hash(password, 10),
            fullName,
            role: Role.WORKER,
            siteId: info.site ? siteIds.get(info.site) : null,
          },
        });
        credentials.push({ fullName, username, password });
        createdUsers++;
      } else if (info.site && !user.siteId) {
        await this.prisma.user.update({ where: { id: user.id }, data: { siteId: siteIds.get(info.site) } });
      }

      for (const skillName of info.skills) {
        const skillId = skillIds.get(skillName);
        if (!skillId) continue;
        const exists = await this.prisma.competency.findUnique({
          where: { userId_skillId: { userId: user.id, skillId } },
        });
        if (!exists) {
          await this.prisma.competency.create({ data: { userId: user.id, skillId } });
          createdCompetencies++;
        }
      }
    }

    summary.push(
      { label: 'Создано сотрудников', value: createdUsers },
      { label: 'Создано компетенций', value: createdCompetencies },
    );
    return { dryRun: false, summary, issues: parsed.issues, credentials };
  }

  // ==================================================================
  // Нормы / изделия (проекты + техкарта)
  // ==================================================================

  /**
   * Разбирает лист «НОРМЫ» из «Посуточных задач»: изделие → проект,
   * операция → навык + шаг техкарты, время на операцию → норма выработки.
   * Шапка ищется динамически: в разных файлах она в 1-й или 2-й строке.
   */
  private parseNorms(sheets: { name: string; rows: SheetRow[] }[], defaultSite?: string) {
    const issues: ImportIssue[] = [];
    const rowsOut: { product: string; operation: string; site: string | null; minutes: number }[] = [];

    const normSheets = sheets.filter((s) => s.name.toLowerCase().includes('норм'));
    if (normSheets.length === 0) {
      throw new BadRequestException('В файле нет листа «НОРМЫ».');
    }

    // Берём лист с наибольшим числом распознанных строк (в файлах есть
    // несколько версий норм — «НОРМЫ», «НОРМЫ от 09.12», «Утверждённые…»).
    let best: { sheet: string; rows: typeof rowsOut; issues: ImportIssue[] } | null = null;

    for (const sheet of normSheets) {
      const headerIdx = findHeaderRow(sheet.rows, ['изделие']);
      if (headerIdx < 0) continue;
      const header = sheet.rows[headerIdx];
      const cProduct = findColumn(header, 'изделие');
      const cOperation = findColumn(header, 'названия строк', 'наименование опер', 'операция', 'этап/опер');
      const cSite = findColumn(header, 'участок');
      const cTime = findColumn(header, 'время на выполн', 'время операции', 'время');
      if (cProduct < 0 || cOperation < 0 || cTime < 0) continue;

      const acc: typeof rowsOut = [];
      const acc_issues: ImportIssue[] = [];
      for (let r = headerIdx + 1; r < sheet.rows.length; r++) {
        const row = sheet.rows[r];
        const product = cellText(row[cProduct]);
        const operation = cellText(row[cOperation]);
        // Участок в файлах заполнен не везде — при импорте можно задать запасной.
        const site = (cSite >= 0 ? cellText(row[cSite]) : '') || (defaultSite ?? '');
        const minutes = cellNumber(row[cTime]);

        if (!product && !operation) continue;
        if (!product || !operation) {
          continue; // строки-итоги и разделители — молча пропускаем
        }
        if (minutes === null || minutes <= 0) {
          acc_issues.push({
            sheet: sheet.name,
            row: r + 1,
            message: `«${product} / ${operation}» — не указано время операции, строка пропущена`,
          });
          continue;
        }
        if (!site) {
          acc_issues.push({
            sheet: sheet.name,
            row: r + 1,
            message: `«${product} / ${operation}» — не указан участок, строка пропущена (можно задать участок по умолчанию)`,
          });
          continue;
        }
        acc.push({ product, operation, site, minutes });
      }

      if (!best || acc.length > best.rows.length) {
        best = { sheet: sheet.name, rows: acc, issues: acc_issues };
      }
    }

    if (!best || best.rows.length === 0) {
      throw new BadRequestException(
        'Не удалось разобрать нормы. Ожидаются колонки «Изделие», «Участок», «Время на выполнение операции».',
      );
    }
    issues.push(...best.issues);
    return { sheetName: best.sheet, rows: best.rows, issues };
  }

  async importNorms(buffer: Buffer, dryRun: boolean, defaultSite?: string): Promise<ImportReport> {
    const sheets = await readWorkbook(buffer);
    const parsed = this.parseNorms(sheets, defaultSite?.trim() || undefined);

    const products = new Set(parsed.rows.map((r) => r.product));
    const operations = new Set(parsed.rows.map((r) => r.operation));
    const sites = new Set(parsed.rows.map((r) => r.site!).filter(Boolean));

    const summary: ImportReport['summary'] = [
      { label: 'Лист', value: parsed.sheetName },
      { label: 'Изделий (проектов)', value: products.size },
      { label: 'Операций (навыков)', value: operations.size },
      { label: 'Участков', value: sites.size },
      { label: 'Строк техкарты', value: parsed.rows.length },
    ];

    if (dryRun) {
      return { dryRun: true, summary, issues: parsed.issues };
    }

    // --- Применение ---
    const siteIds = new Map<string, string>();
    for (const name of sites) {
      const site = await this.prisma.site.upsert({ where: { name }, update: {}, create: { name } });
      siteIds.set(name, site.id);
    }

    // Норма выработки: минуты на штуку → штук за 8-часовую смену.
    // У одной операции в разных изделиях время может отличаться — берём первое
    // и сообщаем о расхождении.
    const skillIds = new Map<string, string>();
    const skillMinutes = new Map<string, number>();
    for (const row of parsed.rows) {
      if (!skillMinutes.has(row.operation)) {
        skillMinutes.set(row.operation, row.minutes);
      } else if (skillMinutes.get(row.operation) !== row.minutes) {
        parsed.issues.push({
          sheet: parsed.sheetName,
          row: 0,
          message: `«${row.operation}» — разное время в разных изделиях (${skillMinutes.get(row.operation)} и ${row.minutes} мин), взято первое`,
        });
      }
    }
    for (const [name, minutes] of skillMinutes) {
      const norm = Math.round((SHIFT_MINUTES / minutes) * 100) / 100;
      const skill = await this.prisma.skill.upsert({
        where: { name },
        update: { norm },
        create: { name, norm },
      });
      skillIds.set(name, skill.id);
    }

    let createdProducts = 0;
    let createdOps = 0;
    const bySequence = new Map<string, number>();
    for (const productName of products) {
      let product = await this.prisma.product.findUnique({ where: { name: productName } });
      if (!product) {
        product = await this.prisma.product.create({ data: { name: productName } });
        createdProducts++;
      }
      bySequence.set(product.id, 0);

      for (const row of parsed.rows.filter((r) => r.product === productName)) {
        const skillId = skillIds.get(row.operation)!;
        const siteId = siteIds.get(row.site!)!;
        const exists = await this.prisma.productOperation.findFirst({
          where: { productId: product.id, skillId, siteId },
        });
        if (!exists) {
          const seq = bySequence.get(product.id) ?? 0;
          await this.prisma.productOperation.create({
            data: { productId: product.id, skillId, siteId, sequence: seq },
          });
          bySequence.set(product.id, seq + 1);
          createdOps++;
        }
      }
    }

    summary.push(
      { label: 'Создано проектов', value: createdProducts },
      { label: 'Создано шагов техкарты', value: createdOps },
    );
    return { dryRun: false, summary, issues: parsed.issues };
  }
}
