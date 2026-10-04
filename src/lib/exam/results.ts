export interface AttemptResultSummary {
  score: number;
  max_score: number;
  percentage: number;
  grade: string;
  correct: number;
  wrong: number;
  unanswered: number;
}

export function parseResultSummary(raw: unknown): AttemptResultSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const score = Number(o.score);
  const max_score = Number(o.max_score);
  const percentage = Number(o.percentage);
  if (!Number.isFinite(score) || !Number.isFinite(max_score)) return null;

  return {
    score,
    max_score,
    percentage: Number.isFinite(percentage)
      ? percentage
      : max_score > 0
        ? Math.round((score / max_score) * 10000) / 100
        : 0,
    grade: String(o.grade ?? '—'),
    correct: Number(o.correct) || 0,
    wrong: Number(o.wrong) || 0,
    unanswered: Number(o.unanswered) || 0,
  };
}

export function letterGradeFromPercentage(pct: number): string {
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}
