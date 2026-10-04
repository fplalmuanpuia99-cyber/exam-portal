import { createClient } from '@/lib/supabase/server';
import { ensureProfile } from '@/lib/auth/ensure-profile';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, BookOpen, Shield } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { StartExamButton } from '@/components/dashboard/StartExamButton';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { profile, error: profileError } = await ensureProfile(supabase, user);

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Profile not ready</CardTitle>
            <CardDescription>
              Your account exists but the database profile is missing. Run the
              Supabase migrations, then refresh this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              In the Supabase SQL Editor, run{' '}
              <code className="rounded bg-muted px-1">
                supabase/migrations/001_initial_schema.sql
              </code>{' '}
              then{' '}
              <code className="rounded bg-muted px-1">
                supabase/migrations/002_profiles_auth_fix.sql
              </code>
              , then{' '}
              <code className="rounded bg-muted px-1">
                supabase/migrations/003_fix_rls_recursion.sql
              </code>
              .
            </p>
            {profileError && (
              <p className="text-red-500">Details: {profileError}</p>
            )}
            <Button asChild className="mt-4">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isInstructor =
    profile.role === 'instructor' || profile.role === 'admin';

  const examsQuery = supabase
    .from('exams')
    .select('id, title, description, duration_minutes, is_published, instructor_id')
    .order('created_at', { ascending: false });

  const scopedExamsQuery = isInstructor
    ? examsQuery.eq('instructor_id', user.id)
    : examsQuery.eq('is_published', true);

  const [{ data: exams }, { data: attempts }] = await Promise.all([
    scopedExamsQuery,
    supabase
      .from('exam_attempts')
      .select('id, exam_id, status')
      .eq('student_id', user.id),
  ]);

  const attemptMap = new Map(
    attempts?.map((a) => [a.exam_id, a]) ?? []
  );

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader profile={profile} />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isInstructor ? 'Your Exams' : 'Available Exams'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isInstructor
                ? 'Create and manage examinations'
                : 'Select an exam to begin'}
            </p>
          </div>

          {isInstructor && (
            <Button asChild>
              <Link href="/dashboard/create">
                <Plus className="mr-2 h-4 w-4" />
                Create Exam
              </Link>
            </Button>
          )}
        </div>

        {!exams?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BookOpen className="mb-4 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">
                {isInstructor
                  ? 'No exams yet. Create your first one.'
                  : 'No published exams available right now.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exams.map((exam) => {
              const attempt = attemptMap.get(exam.id);
              return (
                <Card key={exam.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="line-clamp-1 text-lg">
                      {exam.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {exam.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto space-y-4">
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Shield className="h-3.5 w-3.5" />
                        {exam.duration_minutes} min
                      </span>
                      {exam.is_published ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                          Published
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-600">
                          Draft
                        </span>
                      )}
                    </div>

                    {!isInstructor && (
                      <StartExamButton
                        examId={exam.id}
                        existingAttemptId={attempt?.id}
                        existingStatus={attempt?.status}
                      />
                    )}

                    {isInstructor && (
                      <div className="flex gap-2">
                        <Button asChild variant="outline" size="sm" className="flex-1">
                          <Link href={`/dashboard/exams/${exam.id}`}>
                            Manage
                          </Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
