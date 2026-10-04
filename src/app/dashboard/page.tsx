import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Plus, BookOpen, Shield } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { StartExamButton } from '@/components/dashboard/StartExamButton';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  const isInstructor =
    profile.role === 'instructor' || profile.role === 'admin';

  // Published exams for students / own exams for instructors
  let examsQuery = supabase
    .from('exams')
    .select('*, profiles!instructor_id(full_name)')
    .order('created_at', { ascending: false });

  if (!isInstructor) {
    examsQuery = examsQuery.eq('is_published', true);
  } else {
    examsQuery = examsQuery.eq('instructor_id', user.id);
  }

  const { data: exams } = await examsQuery;

  // Student's existing attempts
  const { data: attempts } = await supabase
    .from('exam_attempts')
    .select('id, exam_id, status')
    .eq('student_id', user.id);

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
