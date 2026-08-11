import * as ExcelJS from 'exceljs';

/** Одна строка листа как массив «сырых» значений ячеек. */
export type SheetRow = (ExcelJS.CellValue | undefined)[];

export interface SheetData {
  name: string;
  rows: SheetRow[];
}

/**
 * Превращает значение ячейки ExcelJS в текст. ExcelJS отдаёт не только строки:
 * формулы приходят объектом с `result`, форматированный текст — с `richText`,
 * гиперссылки — с `text`. Без нормализации парсер ломается на реальных файлах.
 */
export function cellText(value: ExcelJS.CellValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const v = value as unknown as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[]).map((p) => p.text ?? '').join('').trim();
    }
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue);
    if ('text' in v) return String(v.text ?? '').trim();
  }
  return String(value).trim();
}

/** Число из ячейки; для «5,5» и текстовых чисел тоже работает. null — если не число. */
export function cellNumber(value: ExcelJS.CellValue | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = cellText(value).replace(',', '.').replace(/\s/g, '');
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** Читает книгу из буфера в простую структуру «лист → строки». */
export async function readWorkbook(buffer: Buffer): Promise<SheetData[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheets: SheetData[] = [];
  wb.eachSheet((ws) => {
    const rows: SheetRow[] = [];
    // Реальные файлы часто имеют форматирование на весь лист (до 1 млн строк),
    // поэтому идём по фактически заполненным строкам, а не по max_row.
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const values = row.values as ExcelJS.CellValue[];
      // ExcelJS отдаёт values с 1-based индексом (нулевой элемент пустой) и с
      // «дырами» на месте пустых ячеек — уплотняем, иначе map/findIndex падают.
      const dense: SheetRow = [];
      for (let i = 1; i < values.length; i++) dense.push(values[i]);
      rows[rowNumber - 1] = dense;
    });
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    sheets.push({ name: ws.name, rows });
  });
  return sheets;
}

/**
 * Ищет строку-шапку: первую, где встречается любое из ожидаемых названий колонок.
 * У Паши шапка в разных файлах то в 1-й строке, то во 2-й — поэтому не фиксируем.
 */
export function findHeaderRow(rows: SheetRow[], required: string[], limit = 12): number {
  for (let i = 0; i < Math.min(rows.length, limit); i++) {
    const texts = Array.from(rows[i] ?? [], (c) => cellText(c).toLowerCase());
    if (required.every((req) => texts.some((t) => t.startsWith(req.toLowerCase())))) {
      return i;
    }
  }
  return -1;
}

/** Индекс колонки по началу заголовка (первое совпадение из списка вариантов). */
export function findColumn(header: SheetRow, ...variants: string[]): number {
  const texts = Array.from(header ?? [], (c) => cellText(c).toLowerCase());
  for (const v of variants) {
    const idx = texts.findIndex((t) => t.startsWith(v.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}
