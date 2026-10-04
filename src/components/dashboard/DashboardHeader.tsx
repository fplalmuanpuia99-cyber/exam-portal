'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { Profile } from '@/types/database';

export function DashboardHeader({ profile }: { profile: Profile }) {
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
          Exam Portal
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {profile.full_name || profile.email}
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
              {profile.role}
            </span>
          </span>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
