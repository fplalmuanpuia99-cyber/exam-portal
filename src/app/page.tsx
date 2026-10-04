import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Exam Portal
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Secure, high-performance online examinations with real-time
          proctoring and server-synced integrity.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/register">Create account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
