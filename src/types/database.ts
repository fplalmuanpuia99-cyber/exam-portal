export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'admin' | 'instructor' | 'student';

export type AttemptStatus =
  | 'in_progress'
  | 'submitted'
  | 'auto_submitted'
  | 'terminated';

export type QuestionType = 'mcq' | 'multi' | 'text';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
        };
        Update: {
          full_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
        };
      };
      exams: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          instructor_id: string;
          duration_minutes: number;
          start_window: string | null;
          end_window: string | null;
          max_attempts: number;
          is_published: boolean;
          security_settings: Json;
          negative_mark_per_wrong: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          description?: string | null;
          instructor_id: string;
          duration_minutes: number;
          start_window?: string | null;
          end_window?: string | null;
          max_attempts?: number;
          is_published?: boolean;
          security_settings?: Json;
          negative_mark_per_wrong?: number;
        };
        Update: {
          title?: string;
          description?: string | null;
          duration_minutes?: number;
          start_window?: string | null;
          end_window?: string | null;
          max_attempts?: number;
          is_published?: boolean;
          security_settings?: Json;
          negative_mark_per_wrong?: number;
        };
      };
      questions: {
        Row: {
          id: string;
          exam_id: string;
          question_text: string;
          question_type: QuestionType;
          options: Json | null;
          correct_answers: Json | null;
          points: number;
          order_index: number;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          exam_id: string;
          question_text: string;
          question_type: QuestionType;
          options?: Json | null;
          correct_answers?: Json | null;
          points?: number;
          order_index?: number;
          image_url?: string | null;
        };
        Update: {
          question_text?: string;
          question_type?: QuestionType;
          options?: Json | null;
          correct_answers?: Json | null;
          points?: number;
          order_index?: number;
          image_url?: string | null;
        };
      };
      exam_attempts: {
        Row: {
          id: string;
          exam_id: string;
          student_id: string;
          started_at: string;
          submitted_at: string | null;
          status: AttemptStatus;
          score: number | null;
          max_score: number | null;
          violation_count: number;
          server_start_time: string;
          result_summary: Json | null;
          created_at: string;
        };
        Insert: {
          exam_id: string;
          student_id: string;
          status?: AttemptStatus;
          server_start_time?: string;
        };
        Update: {
          submitted_at?: string | null;
          status?: AttemptStatus;
          score?: number | null;
          max_score?: number | null;
          violation_count?: number;
          result_summary?: Json | null;
        };
      };
      student_answers: {
        Row: {
          id: string;
          attempt_id: string;
          question_id: string;
          answer: Json | null;
          is_flagged: boolean;
          answered_at: string | null;
        };
        Insert: {
          attempt_id: string;
          question_id: string;
          answer?: Json | null;
          is_flagged?: boolean;
          answered_at?: string | null;
        };
        Update: {
          answer?: Json | null;
          is_flagged?: boolean;
          answered_at?: string | null;
        };
      };
      exam_violations: {
        Row: {
          id: string;
          attempt_id: string;
          violation_type: string;
          details: Json | null;
          snapshot_path: string | null;
          created_at: string;
        };
        Insert: {
          attempt_id: string;
          violation_type: string;
          details?: Json | null;
          snapshot_path?: string | null;
        };
        Update: never;
      };
    };
    Functions: {
      get_server_time: {
        Args: Record<string, never>;
        Returns: string;
      };
      increment_violation_count: {
        Args: { attempt_id: string };
        Returns: undefined;
      };
      grade_exam_attempt: {
        Args: { attempt_id: string };
        Returns: Json;
      };
    };
  };
}

// Convenience aliases
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Exam = Database['public']['Tables']['exams']['Row'];
export type Question = Database['public']['Tables']['questions']['Row'];
export type ExamAttempt = Database['public']['Tables']['exam_attempts']['Row'];
export type StudentAnswer = Database['public']['Tables']['student_answers']['Row'];
export type ExamViolation = Database['public']['Tables']['exam_violations']['Row'];

export interface QuestionOption {
  id: string;
  text: string;
}
