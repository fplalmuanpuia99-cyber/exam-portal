'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseExamSecurityOptions {
  attemptId: string;
  enabled: boolean;
  onViolation?: (type: string, details?: Record<string, unknown>) => void;
  webcamRequired?: boolean;
}

export function useExamSecurity({
  attemptId,
  enabled,
  onViolation,
  webcamRequired = true,
}: UseExamSecurityOptions) {
  const supabase = createClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const snapshotInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const logViolation = useCallback(
    async (
      type: string,
      details?: Record<string, unknown>,
      snapshotPath?: string
    ) => {
      const { error } = await supabase.from('exam_violations').insert({
        attempt_id: attemptId,
        violation_type: type,
        details: details ?? null,
        snapshot_path: snapshotPath ?? null,
      });

      if (!error) {
        // Increment violation count
        await supabase.rpc('increment_violation_count' as any, {
          attempt_id: attemptId,
        }).catch(() => {
          // fallback if RPC not present
          supabase
            .from('exam_attempts')
            .update({ violation_count: undefined } as any)
            .eq('id', attemptId);
        });
      }

      onViolation?.(type, details);
    },
    [attemptId, onViolation, supabase]
  );

  const captureAndUploadSnapshot = useCallback(async (): Promise<string | null> => {
    if (!videoRef.current || !streamRef.current) return null;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(videoRef.current, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.72)
    );
    if (!blob) return null;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const path = `${user.id}/${attemptId}/${Date.now()}.jpg`;

    const { error } = await supabase.storage
      .from('exam-snapshots')
      .upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Snapshot upload failed', error);
      return null;
    }

    return path;
  }, [attemptId, supabase]);

  useEffect(() => {
    if (!enabled) return;

    const enterFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // User may deny – log it
        logViolation('fullscreen_denied');
      }
    };

    enterFullscreen();

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        logViolation('fullscreen_exit');
        // Re-request after short delay
        setTimeout(enterFullscreen, 800);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        logViolation('tab_switch');
      }
    };

    const onBlur = () => {
      logViolation('focus_loss');
    };

    const blockContextMenu = (e: Event) => {
      e.preventDefault();
      logViolation('right_click');
    };

    const blockKeys = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (
        (e.ctrlKey || e.metaKey) &&
        ['c', 'v', 'x', 'a', 'p', 's', 'u'].includes(key)
      ) {
        e.preventDefault();
        logViolation('copy_paste_attempt', { key });
      }
      if (key === 'printscreen' || key === 'f12' || (e.ctrlKey && e.shiftKey && key === 'i')) {
        e.preventDefault();
        logViolation('devtools_or_printscreen');
      }
    };

    const blockSelect = (e: Event) => e.preventDefault();

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('keydown', blockKeys);
    document.addEventListener('selectstart', blockSelect);
    document.addEventListener('copy', blockContextMenu);
    document.addEventListener('cut', blockContextMenu);
    document.addEventListener('paste', blockContextMenu);

    // Webcam
    if (webcamRequired) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }

          // Periodic snapshots (randomized 45-90s)
          const scheduleNext = () => {
            const delay = 45_000 + Math.random() * 45_000;
            snapshotInterval.current = setTimeout(async () => {
              const path = await captureAndUploadSnapshot();
              if (path) {
                // Heartbeat snapshot – optional log
              }
              scheduleNext();
            }, delay);
          };
          scheduleNext();
        })
        .catch(() => {
          logViolation('webcam_access_denied');
        });
    }

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('keydown', blockKeys);
      document.removeEventListener('selectstart', blockSelect);
      document.removeEventListener('copy', blockContextMenu);
      document.removeEventListener('cut', blockContextMenu);
      document.removeEventListener('paste', blockContextMenu);

      if (snapshotInterval.current) {
        clearTimeout(snapshotInterval.current);
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [enabled, logViolation, captureAndUploadSnapshot, webcamRequired]);

  return {
    videoRef,
    captureAndUploadSnapshot,
    logViolation,
  };
}
