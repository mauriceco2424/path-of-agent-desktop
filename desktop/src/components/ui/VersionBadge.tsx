/**
 * VersionBadge — Etched version inscription for the header utility capsule.
 * Idle: subtle engraved text. Updating: animated amber glow with progress.
 */

import { useState, useEffect } from 'react';
import { Download, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUpdateAvailability } from '../../hooks/useAutoUpdate';

export function VersionBadge() {
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const status = useUpdateAvailability((s) => s.status);
  const availableVersion = useUpdateAvailability((s) => s.availableVersion);
  const progress = useUpdateAvailability((s) => s.progress);

  useEffect(() => {
    (async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        setAppVersion(await getVersion());
      } catch {
        setAppVersion('0.1.3');
      }
    })();
  }, []);

  if (!appVersion) return null;

  const isUpdating = status === 'downloading' || status === 'ready' || status === 'installing';
  const isError = status === 'error';
  const percent = progress?.total ? Math.round((progress.downloaded / progress.total) * 100) : 0;

  return (
    <div className="relative flex items-center gap-1.5 px-2.5 h-8">
      {/* Update status icon */}
      {status === 'downloading' && (
        <Download className="w-3 h-3 text-amber-400 animate-bounce relative z-10" />
      )}
      {(status === 'ready' || status === 'installing') && (
        <RefreshCw className="w-3 h-3 text-green-400 animate-spin relative z-10" />
      )}
      {isError && (
        <AlertCircle className="w-3 h-3 text-red-400 relative z-10" />
      )}

      {/* Version text — etched inscription style */}
      <span
        className={cn(
          'relative z-10 text-[0.625rem] font-mono tracking-widest uppercase',
          'transition-all duration-500',
          isUpdating
            ? 'text-amber-300/90 text-glow-amber'
            : isError
              ? 'text-red-400/70'
              : 'text-slate-500/70',
        )}
      >
        {isUpdating
          ? `v${availableVersion ?? appVersion} ${status === 'downloading' ? `${percent}%` : status === 'installing' ? 'installing…' : 'restarting…'}`
          : `v${appVersion}`}
      </span>

      {/* Micro progress bar when downloading */}
      {status === 'downloading' && progress?.total && (
        <div className="absolute bottom-0 left-0 right-0 h-px overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500/60 to-amber-400/80 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {/* Ambient glow when updating */}
      {isUpdating && (
        <div
          className="absolute inset-0 animate-pulse rounded-md pointer-events-none"
          style={{ boxShadow: '0 0 12px rgba(251, 191, 36, 0.12), inset 0 0 6px rgba(251, 191, 36, 0.04)' }}
        />
      )}
    </div>
  );
}
