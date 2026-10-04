import * as XLSX from 'xlsx';

export interface ParsedQuestionRow {
  question_text: string;
  options: { id: string; text: string }[];
  correct: string;
  points: number;
}

const OPTION_IDS = ['a', 'b', 'c', 'd'] as const;

function cell(row: unknown[], index: number): string {
  const v = row[index];
  if (v == null) return '';
  return String(v).trim();
}

function normalizeCorrect(raw: string): string {
  const c = raw.toLowerCase().trim();
  if (OPTION_IDS.includes(c as (typeof OPTION_IDS)[number])) return c;
  const letter = c.charAt(0);
  if (OPTION_IDS.includes(letter as (typeof OPTION_IDS)[number])) return letter;
  return 'a';
}

/**
 * Expected header row (case-insensitive):
 * Question | Option A | Option B | Option C | Option D | Correct | Points
 */
export function parseQuestionExcel(file: ArrayBuffer): ParsedQuestionRow[] {
  const workbook = XLSX.read(file, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
  }) as unknown[][];

  if (rows.length < 2) return [];

  const startIndex = 1;
  const parsed: ParsedQuestionRow[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row?.length) continue;

    const question_text = cell(row, 0);
    if (!question_text) continue;

    const options = OPTION_IDS.map((id, idx) => ({
      id,
      text: cell(row, idx + 1),
    }));

    const correct = normalizeCorrect(cell(row, 5));
    const pointsRaw = cell(row, 6);
    const points = pointsRaw ? Number(pointsRaw) : 1;
    const pointsSafe = Number.isFinite(points) && points > 0 ? points : 1;

    parsed.push({
      question_text,
      options,
      correct,
      points: pointsSafe,
    });
  }

  return parsed;
}

export function buildExcelTemplate(): ArrayBuffer {
  const data = [
    [
      'Question',
      'Option A',
      'Option B',
      'Option C',
      'Option D',
      'Correct',
      'Points',
    ],
    [
      'What is 2 + 2?',
      '3',
      '4',
      '5',
      '6',
      'b',
      1,
    ],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Questions');
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}
