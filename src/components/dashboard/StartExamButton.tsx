'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface Props {
  examId: string;
  existingAttemptId?: string;
  existingStatus?: string;
}

export function StartExamButton({
  examId,
  existingAttemptId,
  existingStatus,
}: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleStart = async () => {
    setLoading(true);

    // Resume existing in-progress attempt
    if (existingAttemptId && existingStatus === 'in_progress') {
      router.push(`/exam/${existingAttemptId}`);
      return;
    }

    // Already submitted
    if (existingAttemptId && existingStatus !== 'in_progress') {
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: attempt, error } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: examId,
        student_id: user.id,
        status: 'in_progress',
      })
      .select('id')
      .single();

    if (error || !attempt) {
      console.error(error);
      setLoading(false);
      return;
    }

    router.push(`/exam/${attempt.id}`);
  };

  if (existingAttemptId && existingStatus !== 'in_progress') {
    return (
      <Button variant="secondary" size="sm" className="w-full" disabled>
        Already submitted
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      className="w-full"
      onClick={handleStart}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Starting…
        </>
      ) : existingAttemptId ? (
        'Resume Exam'
      ) : (
        'Start Exam'
      )}
    </Button>
  );
}
