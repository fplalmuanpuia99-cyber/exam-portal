'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface QuestionDraft {
  question_text: string;
  options: { id: string; text: string }[];
  correct: string;
  points: number;
}

export default function CreateExamPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    {
      question_text: '',
      options: [
        { id: 'a', text: '' },
        { id: 'b', text: '' },
        { id: 'c', text: '' },
        { id: 'd', text: '' },
      ],
      correct: 'a',
      points: 1,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const addQuestion = () => {
    setQuestions((q) => [
      ...q,
      {
        question_text: '',
        options: [
          { id: 'a', text: '' },
          { id: 'b', text: '' },
          { id: 'c', text: '' },
          { id: 'd', text: '' },
        ],
        correct: 'a',
        points: 1,
      },
    ]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions((q) => q.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, patch: Partial<QuestionDraft>) => {
    setQuestions((q) =>
      q.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  const updateOption = (
    qIdx: number,
    optIdx: number,
    text: string
  ) => {
    setQuestions((qs) =>
      qs.map((q, i) => {
        if (i !== qIdx) return q;
        const options = [...q.options];
        options[optIdx] = { ...options[optIdx], text };
        return { ...q, options };
      })
    );
  };

  const handleCreate = async (publish: boolean) => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title,
        description: description || null,
        instructor_id: user.id,
        duration_minutes: duration,
        is_published: publish,
      })
      .select('id')
      .single();

    if (examError || !exam) {
      setError(examError?.message ?? 'Failed to create exam');
      setLoading(false);
      return;
    }

    const questionRows = questions.map((q, i) => ({
      exam_id: exam.id,
      question_text: q.question_text,
      question_type: 'mcq' as const,
      options: q.options,
      correct_answers: [q.correct],
      points: q.points,
      order_index: i,
    }));

    const { error: qError } = await supabase
      .from('questions')
      .insert(questionRows);

    if (qError) {
      setError(qError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Create Exam</h1>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">Cancel</Link>
          </Button>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Exam details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Midterm Examination"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </CardContent>
          </Card>

          {questions.map((q, qi) => (
            <Card key={qi}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Question {qi + 1}</CardTitle>
                {questions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeQuestion(qi)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  value={q.question_text}
                  onChange={(e) =>
                    updateQuestion(qi, { question_text: e.target.value })
                  }
                  rows={2}
                  placeholder="Enter question text…"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${qi}`}
                        checked={q.correct === opt.id}
                        onChange={() =>
                          updateQuestion(qi, { correct: opt.id })
                        }
                      />
                      <span className="w-6 text-sm font-medium uppercase text-muted-foreground">
                        {opt.id}
                      </span>
                      <input
                        value={opt.text}
                        onChange={(e) => updateOption(qi, oi, e.target.value)}
                        placeholder={`Option ${opt.id.toUpperCase()}`}
                        className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" onClick={addQuestion} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add question
          </Button>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              disabled={loading || !title}
              onClick={() => handleCreate(false)}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save as draft
            </Button>
            <Button
              disabled={loading || !title}
              onClick={() => handleCreate(true)}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Publish exam
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
