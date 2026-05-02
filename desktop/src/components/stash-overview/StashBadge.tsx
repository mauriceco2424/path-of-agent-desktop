/**
 * StashBadge — Header badge for stash overview access.
 *
 * Matches LadderBadge styling. Shows vault icon with amber accent
 * when OAuth token is available, grayed out when not.
 */

import { PackageOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StashBadgeProps {
  hasToken: boolean;
  onClick: () => void;
}

export function StashBadge({ hasToken, onClick }: StashBadgeProps) {
  return (
    <button
      onClick={hasToken ? onClick : undefined}
      className={cn(
        'group relative flex items-center gap-2 px-3 py-1.5 h-8',
        'rounded-lg',
        'transition-all duration-200',
        hasToken
          ? [
              'bg-gradient-to-b from-amber-500/12 to-amber-900/8',
              'border border-amber-500/25 hover:border-amber-400/50',
              'shadow-[inset_0_1px_0_rgba(251,191,36,0.08),0_1px_3px_rgba(0,0,0,0.3)]',
              'hover:shadow-[inset_0_1px_0_rgba(251,191,36,0.12),0_1px_6px_rgba(0,0,0,0.4),0_0_12px_rgba(251,191,36,0.08)]',
              'cursor-pointer',
            ]
          : 'bg-slate-800/30 border border-slate-700/20 cursor-default opacity-40'
      )}
      title={hasToken ? 'View stash overview & wealth analysis' : 'Log in with PoE to view stash overview'}
    >
      <div className="relative">
        <PackageOpen className={cn('w-3.5 h-3.5 relative z-10', hasToken ? 'text-amber-400' : 'text-slate-600')} />
        {hasToken && <div className="absolute inset-0 blur-sm bg-amber-500/30 rounded-full" />}
      </div>
      {hasToken && (
        <span className="text-[0.625rem] font-display font-semibold text-amber-300/80 uppercase tracking-wider">
          Stash
        </span>
      )}
    </button>
  );
}
