import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { ExamClient } from './ExamClient';

interface Props {
  params: Promise<{ attemptId: string }>;
}

export default async function ExamPage({ params }: Props) {
  const { attemptId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: attempt } = await supabase
    .from('exam_attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('student_id', user.id)
    .single();

  if (!attempt) notFound();

  if (attempt.status !== 'in_progress') {
    redirect('/dashboard');
  }

  const { data: exam } = await supabase
    .from('exams')
    .select('*')
    .eq('id', attempt.exam_id)
    .single();

  if (!exam) notFound();

  const { data: questions } = await supabase
    .from('questions')
    .select('*')
    .eq('exam_id', exam.id)
    .order('order_index', { ascending: true });

  if (!questions?.length) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">This exam has no questions yet.</p>
      </div>
    );
  }

  return (
    <ExamClient
      attempt={attempt}
      questions={questions}
      examDuration={exam.duration_minutes}
    />
  );
}
