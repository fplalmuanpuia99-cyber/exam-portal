'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ExamViewport } from '@/components/exam/ExamViewport';
import type { ExamAttempt, Question } from '@/types/database';

interface Props {
  attempt: ExamAttempt;
  questions: Question[];
  examDuration: number;
}

export function ExamClient({ attempt, questions, examDuration }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async () => {
    const { error: gradeError } = await supabase.rpc('grade_exam_attempt', {
      attempt_id: attempt.id,
    });

    if (gradeError) {
      await supabase
        .from('exam_attempts')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', attempt.id);
    }

    localStorage.removeItem(`exam-answers-${attempt.id}`);

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }

    router.push(`/exam/${attempt.id}/results`);
    router.refresh();
  };

  return (
    <ExamViewport
      attempt={attempt}
      questions={questions}
      examDuration={examDuration}
      onSubmit={handleSubmit}
    />
  );
}
