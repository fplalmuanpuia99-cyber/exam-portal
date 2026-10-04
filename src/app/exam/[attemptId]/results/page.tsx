import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { parseResultSummary, letterGradeFromPercentage } from '@/lib/exam/results';

interface Props {
  params: Promise<{ attemptId: string }>;
}

export default async function ExamResultsPage({ params }: Props) {
  const { attemptId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: attempt } = await supabase
    .from('exam_attempts')
    .select('*, exams(title, negative_mark_per_wrong)')
    .eq('id', attemptId)
    .eq('student_id', user.id)
    .single();

  if (!attempt) notFound();

  if (attempt.status === 'in_progress') {
    redirect(`/exam/${attemptId}`);
  }

  let summary = parseResultSummary(attempt.result_summary);

  if (!summary && attempt.score != null && attempt.max_score != null) {
    const pct =
      attempt.max_score > 0
        ? Math.round((attempt.score / attempt.max_score) * 10000) / 100
        : 0;
    summary = {
      score: attempt.score,
      max_score: attempt.max_score,
      percentage: pct,
      grade: letterGradeFromPercentage(pct),
      correct: 0,
      wrong: 0,
      unanswered: 0,
    };
  }

  const examTitle =
    attempt.exams && typeof attempt.exams === 'object' && 'title' in attempt.exams
      ? String((attempt.exams as { title: string }).title)
      : 'Exam';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Exam submitted</CardTitle>
          <p className="text-sm text-muted-foreground">{examTitle}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {summary ? (
            <>
              <div className="flex flex-col items-center gap-1">
                <span className="text-5xl font-semibold tabular-nums tracking-tight">
                  {summary.percentage}%
                </span>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium">
                  Grade {summary.grade}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-muted-foreground">Score</dt>
                  <dd className="text-lg font-medium tabular-nums">
                    {summary.score} / {summary.max_score}
                  </dd>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-muted-foreground">Correct</dt>
                  <dd className="text-lg font-medium text-emerald-600 dark:text-emerald-400">
                    {summary.correct}
                  </dd>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-muted-foreground">Wrong</dt>
                  <dd className="text-lg font-medium text-red-500">
                    {summary.wrong}
                  </dd>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-muted-foreground">Unanswered</dt>
                  <dd className="text-lg font-medium">{summary.unanswered}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="text-center text-muted-foreground">
              Your attempt was submitted. Results are not available yet.
            </p>
          )}

          <Button asChild className="w-full">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
