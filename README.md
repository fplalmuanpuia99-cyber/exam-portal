# Exam Portal

Production-grade, highly secure online examination platform.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Framer Motion · Lucide React · Supabase

## Features

- **Server-synced timer** via Supabase RPC (`get_server_time`) – immune to client clock tampering
- **Aggressive browser lockdown**: fullscreen enforcement, tab-switch / focus-loss detection, blocked right-click, copy/paste, print-screen & DevTools shortcuts
- **Webcam surveillance**: periodic snapshots uploaded to private Supabase Storage
- **Immutable violation log** with timestamps and optional snapshot paths
- **Offline answer resilience**: localStorage auto-save + Supabase upsert
- **Role-based access**: student / instructor / admin with strict RLS
- **Immersive exam UI**: distraction-free viewport, dynamic question palette, Framer Motion transitions
- **Clean Vercel/Linear aesthetic**: glassmorphism, Geist typography, dark-mode ready

## Quick Start

### 1. Clone & install

```bash
git clone <your-repo-url>
cd exam-portal
npm install
```

### 2. Supabase setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste and run, **in order**:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_profiles_auth_fix.sql` (backfills profiles so login → dashboard works)
   - `supabase/migrations/003_fix_rls_recursion.sql` (fixes “infinite recursion” on `profiles` RLS)
   - `supabase/migrations/004_exam_grading_and_features.sql` (grading RPC, negative marks, question images)
3. Create a **private** Storage bucket named `exam-snapshots`
4. (Optional) Add the storage policies commented at the bottom of the migration file
5. Copy your project URL and publishable key into `.env.local`:

```bash
cp .env.example .env.local
# edit .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Deploy to Vercel

1. Push the repo to GitHub
2. Import the project in Vercel
3. Add the same environment variables
4. Deploy

## Project Structure

```
exam-portal/
├── src/
│   ├── app/
│   │   ├── (auth)/login & register
│   │   ├── dashboard/          # role-aware home
│   │   ├── dashboard/create/   # exam builder
│   │   ├── exam/[attemptId]/  # immersive exam viewport
│   │   └── ...
│   ├── components/
│   │   ├── exam/ExamViewport.tsx   # core exam UI + security
│   │   ├── dashboard/
│   │   └── ui/                     # Button, Card primitives
│   ├── hooks/
│   │   ├── useExamSecurity.ts      # lockdown + webcam
│   │   └── useServerTimer.ts       # authoritative countdown
│   ├── lib/supabase/               # browser + server clients
│   └── types/database.ts
├── supabase/migrations/
└── ...
```

## Security Notes

- All tables have **Row Level Security** enabled.
- Students can only insert their own violations and answers.
- Instructors/admins can read attempts, answers and violation logs for their exams.
- Webcam snapshots are stored under `{userId}/{attemptId}/…` in a private bucket.
- Timer is driven by server time; client only displays the remaining seconds.
- Fullscreen + focus listeners fire immutable violation records.

## Extending

- **Scoring**: add an RPC that calculates score from `student_answers` vs `correct_answers` on submit.
- **Real-time monitoring**: subscribe to `exam_attempts` and `exam_violations` with Supabase Realtime on the instructor dashboard.
- **Multi-attempt**: remove the `UNIQUE(exam_id, student_id)` constraint and adjust the start logic.
- **Text / multi-select questions**: the schema already supports `question_type`; extend the UI renderer.

## License

MIT
