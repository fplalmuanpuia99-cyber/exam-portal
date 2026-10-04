'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatTime } from '@/lib/utils';

export function useServerTimer(
  serverStartTime: string,
  durationMinutes: number
) {
  const [remaining, setRemaining] = useState(durationMinutes * 60);
  const [synced, setSynced] = useState(false);
  const supabase = createClient();

  const sync = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_server_time');
    if (error || !data) return;

    const serverNow = new Date(data).getTime();
    const start = new Date(serverStartTime).getTime();
    const elapsed = Math.floor((serverNow - start) / 1000);
    const left = Math.max(0, durationMinutes * 60 - elapsed);
    setRemaining(left);
    setSynced(true);
  }, [serverStartTime, durationMinutes, supabase]);

  useEffect(() => {
    sync();
    const interval = setInterval(sync, 30_000); // re-sync every 30s
    return () => clearInterval(interval);
  }, [sync]);

  useEffect(() => {
    if (!synced) return;
    const tick = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [synced]);

  return {
    remaining,
    formatted: formatTime(remaining),
    isExpired: remaining <= 0,
    synced,
  };
}
