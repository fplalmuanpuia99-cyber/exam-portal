-- ============================================================
-- Fix: infinite recursion in profiles RLS policies
-- Policies must not SELECT from public.profiles directly;
-- use SECURITY DEFINER helpers instead.
-- Run after 001 and 002.
-- ============================================================

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

-- Profiles
DROP POLICY IF EXISTS "Admins and instructors can view profiles" ON public.profiles;
CREATE POLICY "Admins and instructors can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_instructor_or_admin());

-- Exams
DROP POLICY IF EXISTS "Published exams visible to authenticated users" ON public.exams;
CREATE POLICY "Published exams visible to authenticated users"
  ON public.exams FOR SELECT
  TO authenticated
  USING (
    is_published = true
    OR instructor_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Instructors manage own exams" ON public.exams;
CREATE POLICY "Instructors manage own exams"
  ON public.exams FOR ALL
  TO authenticated
  USING (
    instructor_id = auth.uid()
    OR public.is_admin()
  );

-- Questions
DROP POLICY IF EXISTS "Questions visible with accessible exam" ON public.questions;
CREATE POLICY "Questions visible with accessible exam"
  ON public.questions FOR SELECT
  TO authenticated
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

DROP POLICY IF EXISTS "Instructors manage questions of own exams" ON public.questions;
CREATE POLICY "Instructors manage questions of own exams"
  ON public.questions FOR ALL
  TO authenticated
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
DROP POLICY IF EXISTS "Instructors view attempts of their exams" ON public.exam_attempts;
CREATE POLICY "Instructors view attempts of their exams"
  ON public.exam_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_id AND e.instructor_id = auth.uid()
    )
    OR public.is_admin()
  );

-- Answers
DROP POLICY IF EXISTS "Instructors view answers of their exams" ON public.student_answers;
CREATE POLICY "Instructors view answers of their exams"
  ON public.student_answers FOR SELECT
  TO authenticated
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

-- Violations
DROP POLICY IF EXISTS "Instructors and admins view violations" ON public.exam_violations;
CREATE POLICY "Instructors and admins view violations"
  ON public.exam_violations FOR SELECT
  TO authenticated
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
