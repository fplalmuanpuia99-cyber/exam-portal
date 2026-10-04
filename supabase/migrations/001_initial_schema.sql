-- ============================================================
-- Exam Portal - Full Production Schema + RLS
-- Run in Supabase SQL Editor or via CLI
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- Profiles (extends auth.users)
-- ------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'instructor', 'student')) DEFAULT 'student',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Exams
-- ------------------------------------------------------------
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  instructor_id UUID NOT NULL REFERENCES public.profiles(id),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  start_window TIMESTAMPTZ,
  end_window TIMESTAMPTZ,
  max_attempts INTEGER DEFAULT 1,
  is_published BOOLEAN DEFAULT FALSE,
  security_settings JSONB DEFAULT '{
    "fullscreen_required": true,
    "webcam_required": true,
    "tab_switch_limit": 3,
    "copy_paste_blocked": true,
    "right_click_blocked": true
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Questions
-- ------------------------------------------------------------
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'multi', 'text')),
  options JSONB,
  correct_answers JSONB,
  points NUMERIC(5,2) DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Exam Attempts
-- ------------------------------------------------------------
CREATE TABLE public.exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'auto_submitted', 'terminated')),
  score NUMERIC(8,2),
  max_score NUMERIC(8,2),
  violation_count INTEGER DEFAULT 0,
  server_start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, student_id)
);

-- ------------------------------------------------------------
-- Student Answers
-- ------------------------------------------------------------
CREATE TABLE public.student_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer JSONB,
  is_flagged BOOLEAN DEFAULT FALSE,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (attempt_id, question_id)
);

-- ------------------------------------------------------------
-- Violations (immutable audit log)
-- ------------------------------------------------------------
CREATE TABLE public.exam_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL,
  details JSONB,
  snapshot_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
CREATE INDEX idx_exam_attempts_student ON public.exam_attempts (student_id);
CREATE INDEX idx_exam_attempts_exam ON public.exam_attempts (exam_id);
CREATE INDEX idx_student_answers_attempt ON public.student_answers (attempt_id);
CREATE INDEX idx_violations_attempt ON public.exam_violations (attempt_id);
CREATE INDEX idx_questions_exam_order ON public.questions (exam_id, order_index);
CREATE INDEX idx_exams_instructor ON public.exams (instructor_id);

-- ------------------------------------------------------------
-- Server time RPC (authoritative timer source)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS TIMESTAMPTZ
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOW();
$$;

-- ------------------------------------------------------------
-- Auto-create profile on signup
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- updated_at helper
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER exams_updated
  BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Role helpers (SECURITY DEFINER — avoid RLS recursion on profiles)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_instructor_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'instructor')
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_instructor_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_instructor_or_admin() TO authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_violations ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins and instructors can view profiles"
  ON public.profiles FOR SELECT
  USING (public.is_instructor_or_admin());

-- Exams
CREATE POLICY "Published exams visible to authenticated users"
  ON public.exams FOR SELECT
  USING (
    is_published = true
    OR instructor_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY "Instructors manage own exams"
  ON public.exams FOR ALL
  USING (
    instructor_id = auth.uid()
    OR public.is_admin()
  );

-- Questions
CREATE POLICY "Questions visible with accessible exam"
  ON public.questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_id
        AND (
          e.is_published
          OR e.instructor_id = auth.uid()
          OR public.is_admin()
        )
    )
  );

CREATE POLICY "Instructors manage questions of own exams"
  ON public.questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_id
        AND (
          e.instructor_id = auth.uid()
          OR public.is_admin()
        )
    )
  );

-- Attempts
CREATE POLICY "Students manage own attempts"
  ON public.exam_attempts FOR ALL
  USING (student_id = auth.uid());

CREATE POLICY "Instructors view attempts of their exams"
  ON public.exam_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_id AND e.instructor_id = auth.uid()
    )
    OR public.is_admin()
  );

-- Answers
CREATE POLICY "Students manage own answers"
  ON public.student_answers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_attempts a
      WHERE a.id = attempt_id AND a.student_id = auth.uid()
    )
  );

CREATE POLICY "Instructors view answers of their exams"
  ON public.student_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.exam_attempts a
      JOIN public.exams e ON e.id = a.exam_id
      WHERE a.id = attempt_id
        AND (
          e.instructor_id = auth.uid()
          OR public.is_admin()
        )
    )
  );

-- Violations (students insert only, instructors/admins read)
CREATE POLICY "Students can insert own violations"
  ON public.exam_violations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exam_attempts a
      WHERE a.id = attempt_id AND a.student_id = auth.uid()
    )
  );

CREATE POLICY "Instructors and admins view violations"
  ON public.exam_violations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.exam_attempts a
      JOIN public.exams e ON e.id = a.exam_id
      WHERE a.id = attempt_id
        AND (
          e.instructor_id = auth.uid()
          OR public.is_admin()
        )
    )
  );

-- ============================================================
-- Storage bucket (create via Dashboard or CLI)
-- Bucket name: exam-snapshots (private)
-- ============================================================
-- Policy example (run after creating the bucket):
/*
CREATE POLICY "Students upload own snapshots"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'exam-snapshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Instructors/Admins can read snapshots"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'exam-snapshots'
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'instructor')
    )
  )
);
*/
