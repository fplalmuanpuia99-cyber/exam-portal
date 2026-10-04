-- Exam features: negative marking, question images, violation RPC, auto-grading

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS negative_mark_per_wrong NUMERIC(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.exam_attempts
  ADD COLUMN IF NOT EXISTS result_summary JSONB;

CREATE OR REPLACE FUNCTION public.increment_violation_count(attempt_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.exam_attempts
  SET violation_count = COALESCE(violation_count, 0) + 1
  WHERE id = attempt_id
    AND student_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.grade_exam_attempt(attempt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt public.exam_attempts%ROWTYPE;
  v_exam public.exams%ROWTYPE;
  v_negative NUMERIC;
  v_max_score NUMERIC := 0;
  v_score NUMERIC := 0;
  v_correct INT := 0;
  v_wrong INT := 0;
  v_unanswered INT := 0;
  v_q RECORD;
  v_ans JSONB;
  v_student_ans TEXT;
  v_pct NUMERIC;
  v_grade TEXT;
  v_summary JSONB;
BEGIN
  SELECT * INTO v_attempt FROM public.exam_attempts WHERE id = attempt_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found';
  END IF;

  IF v_attempt.student_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_exam FROM public.exams WHERE id = v_attempt.exam_id;
  v_negative := COALESCE(v_exam.negative_mark_per_wrong, 0);

  FOR v_q IN
    SELECT * FROM public.questions
    WHERE exam_id = v_attempt.exam_id
    ORDER BY order_index
  LOOP
    v_max_score := v_max_score + COALESCE(v_q.points, 0);

    SELECT sa.answer INTO v_ans
    FROM public.student_answers sa
    WHERE sa.attempt_id = attempt_id AND sa.question_id = v_q.id;

    IF v_ans IS NULL OR v_ans = 'null'::jsonb OR v_ans::text = '""' THEN
      v_unanswered := v_unanswered + 1;
      CONTINUE;
    END IF;

    IF jsonb_typeof(v_ans) = 'string' THEN
      v_student_ans := lower(trim(both '"' from v_ans::text));
    ELSE
      v_student_ans := lower(v_ans::text);
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(v_q.correct_answers, '[]'::jsonb)) AS ca(ans)
      WHERE lower(ca.ans) = v_student_ans
    ) THEN
      v_correct := v_correct + 1;
      v_score := v_score + COALESCE(v_q.points, 0);
    ELSE
      v_wrong := v_wrong + 1;
      v_score := v_score - v_negative;
    END IF;
  END LOOP;

  IF v_score < 0 THEN
    v_score := 0;
  END IF;

  v_pct := CASE
    WHEN v_max_score > 0 THEN round((v_score / v_max_score) * 100, 2)
    ELSE 0
  END;

  v_grade := CASE
    WHEN v_pct >= 90 THEN 'A'
    WHEN v_pct >= 80 THEN 'B'
    WHEN v_pct >= 70 THEN 'C'
    WHEN v_pct >= 60 THEN 'D'
    ELSE 'F'
  END;

  v_summary := jsonb_build_object(
    'score', v_score,
    'max_score', v_max_score,
    'percentage', v_pct,
    'grade', v_grade,
    'correct', v_correct,
    'wrong', v_wrong,
    'unanswered', v_unanswered
  );

  UPDATE public.exam_attempts
  SET
    status = CASE
      WHEN status = 'in_progress' THEN 'submitted'
      ELSE status
    END,
    submitted_at = COALESCE(submitted_at, NOW()),
    score = v_score,
    max_score = v_max_score,
    result_summary = v_summary
  WHERE id = attempt_id;

  RETURN v_summary;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_violation_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grade_exam_attempt(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_violation_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grade_exam_attempt(UUID) TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public read question images" ON storage.objects;
CREATE POLICY "Public read question images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'question-images');

DROP POLICY IF EXISTS "Authenticated upload question images" ON storage.objects;
CREATE POLICY "Authenticated upload question images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'question-images');
