'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flag,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
} from 'lucide-react';
import { useExamSecurity } from '@/hooks/useExamSecurity';
import { useServerTimer } from '@/hooks/useServerTimer';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { Question, ExamAttempt, QuestionOption } from '@/types/database';
import { Button } from '@/components/ui/button';

interface ExamViewportProps {
  attempt: ExamAttempt;
  questions: Question[];
  examDuration: number;
  onSubmit: () => Promise<void>;
}

export function ExamViewport({
  attempt,
  questions,
  examDuration,
  onSubmit,
}: ExamViewportProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();

  const { remaining, formatted, isExpired } = useServerTimer(
    attempt.server_start_time,
    examDuration
  );

  const { videoRef } = useExamSecurity({
    attemptId: attempt.id,
    enabled: true,
    webcamRequired: true,
  });

  // Load offline cache
  useEffect(() => {
    const key = `exam-answers-${attempt.id}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        setAnswers(parsed.answers ?? {});
        setFlagged(new Set(parsed.flagged ?? []));
      }
    } catch {
      // ignore
    }
  }, [attempt.id]);

  const persist = useCallback(
    async (
      nextAnswers: Record<string, string | string[]>,
      nextFlagged: Set<string>
    ) => {
      setSaving(true);
      const key = `exam-answers-${attempt.id}`;
      localStorage.setItem(
        key,
        JSON.stringify({
          answers: nextAnswers,
          flagged: Array.from(nextFlagged),
        })
      );

      // Upsert to Supabase
      const entries = Object.entries(nextAnswers);
      for (const [qId, ans] of entries) {
        await supabase.from('student_answers').upsert(
          {
            attempt_id: attempt.id,
            question_id: qId,
            answer: ans,
            is_flagged: nextFlagged.has(qId),
            answered_at: new Date().toISOString(),
          },
          { onConflict: 'attempt_id,question_id' }
        );
      }
      setSaving(false);
    },
    [attempt.id, supabase]
  );

  const selectAnswer = (qId: string, value: string | string[]) => {
    const next = { ...answers, [qId]: value };
    setAnswers(next);
    persist(next, flagged);
  };

  const toggleFlag = (qId: string) => {
    const next = new Set(flagged);
    if (next.has(qId)) next.delete(qId);
    else next.add(qId);
    setFlagged(next);
    persist(answers, next);
  };

  useEffect(() => {
    if (isExpired && !submitting) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpired]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    await onSubmit();
  };

  const current = questions[currentIdx];
  const options = (current?.options as QuestionOption[] | null) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background select-none">
      {/* Hidden webcam feed */}
      <video
        ref={videoRef}
        className="pointer-events-none fixed -left-[9999px] opacity-0"
        muted
        playsInline
      />

      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6 glass">
        <div className="flex items-center gap-3">
          <Clock
            className={cn(
              'h-4 w-4',
              remaining < 300 ? 'text-red-500' : 'text-muted-foreground'
            )}
          />
          <span
            className={cn(
              'font-mono text-lg tabular-nums tracking-tight',
              remaining < 300 && 'text-red-500 font-semibold'
            )}
          >
            {formatted}
          </span>
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving
            </span>
          )}
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            'Submit Exam'
          )}
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main question area */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div className="space-y-4">
                    <h2 className="text-xl font-medium leading-relaxed tracking-tight">
                      <span className="mr-2 text-muted-foreground">
                        {currentIdx + 1}.
                      </span>
                      {current.question_text}
                    </h2>
                    {current.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={current.image_url}
                        alt=""
                        className="max-h-64 w-full rounded-lg border border-border object-contain"
                      />
                    )}
                  </div>
                  <button
                    onClick={() => toggleFlag(current.id)}
                    className={cn(
                      'shrink-0 rounded-lg p-2 transition-colors',
                      flagged.has(current.id)
                        ? 'bg-amber-500/15 text-amber-500'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                    title="Flag for review"
                  >
                    <Flag className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {options.map((opt) => {
                    const selected = answers[current.id] === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all',
                          selected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/40 hover:bg-muted/30'
                        )}
                      >
                        <input
                          type="radio"
                          name={current.id}
                          className="sr-only"
                          checked={selected}
                          onChange={() => selectAnswer(current.id, opt.id)}
                        />
                        <div
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                            selected
                              ? 'border-primary'
                              : 'border-muted-foreground/40'
                          )}
                        >
                          {selected && (
                            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                          )}
                        </div>
                        <span className="text-[15px]">{opt.text}</span>
                      </label>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-12 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((i) => i - 1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={currentIdx === questions.length - 1}
                onClick={() => setCurrentIdx((i) => i + 1)}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </main>

        {/* Question palette */}
        <aside className="hidden w-64 shrink-0 border-l border-border bg-muted/20 p-4 md:block">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Questions
          </p>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, i) => {
              const answered = answers[q.id] != null;
              const isFlagged = flagged.has(q.id);
              const isCurrent = i === currentIdx;

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIdx(i)}
                  className={cn(
                    'relative aspect-square rounded-lg text-sm font-medium transition-all',
                    isCurrent &&
                      'ring-2 ring-primary ring-offset-2 ring-offset-background',
                    answered
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                    isFlagged && 'ring-1 ring-amber-500'
                  )}
                >
                  {i + 1}
                  {isFlagged && (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-emerald-500/30" />
              Answered
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-muted" />
              Not visited
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded ring-1 ring-amber-500" />
              Flagged
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
