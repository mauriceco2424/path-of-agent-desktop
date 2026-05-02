/**
 * SocketChainDisplay Component - Premium PoE Socket Visualization
 *
 * Renders a horizontal chain of socket orbs with metallic link bars,
 * featuring authentic PoE-style socket colors with depth and polish.
 */

import { cn } from '../../lib/utils';

interface SocketChainDisplayProps {
  /** Socket data: array of {color, group} where group indicates link groups */
  sockets: Array<{ color: string; group: number }>;
  /** Whether this is the main skill group (amber highlight) */
  isMainGroup?: boolean;
  /** Optional className for the container */
  className?: string;
}

/**
 * Socket color configurations with gradients for depth
 * Each socket has a primary color, glow, and border styling
 */
const SOCKET_STYLES: Record<string, {
  gradient: string;
  shadow: string;
  border: string;
  glow: string;
}> = {
  R: {
    gradient: 'bg-gradient-to-br from-red-400 via-red-500 to-red-700',
    shadow: 'shadow-[0_0_6px_rgba(239,68,68,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)]',
    border: 'border-red-400/50',
    glow: 'rgba(239,68,68,0.4)',
  },
  G: {
    gradient: 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-700',
    shadow: 'shadow-[0_0_6px_rgba(16,185,129,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)]',
    border: 'border-emerald-400/50',
    glow: 'rgba(16,185,129,0.4)',
  },
  B: {
    gradient: 'bg-gradient-to-br from-blue-400 via-blue-500 to-blue-700',
    shadow: 'shadow-[0_0_6px_rgba(59,130,246,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)]',
    border: 'border-blue-400/50',
    glow: 'rgba(59,130,246,0.4)',
  },
  W: {
    gradient: 'bg-gradient-to-br from-slate-100 via-slate-200 to-slate-400',
    shadow: 'shadow-[0_0_6px_rgba(226,232,240,0.4),inset_0_1px_1px_rgba(255,255,255,0.5)]',
    border: 'border-slate-300/50',
    glow: 'rgba(226,232,240,0.3)',
  },
  A: {
    gradient: 'bg-gradient-to-br from-slate-500 via-slate-600 to-slate-800',
    shadow: 'shadow-[0_0_4px_rgba(71,85,105,0.4),inset_0_1px_1px_rgba(255,255,255,0.1)]',
    border: 'border-slate-500/50',
    glow: 'rgba(71,85,105,0.3)',
  },
};

/**
 * Get socket style for a given color code
 */
function getSocketStyle(color: string) {
  return SOCKET_STYLES[color] || SOCKET_STYLES['W'];
}

/**
 * Group sockets by their link group
 */
function groupSocketsByLink(
  sockets: Array<{ color: string; group: number }>
): Array<Array<{ color: string; group: number }>> {
  if (sockets.length === 0) return [];

  const groups: Array<Array<{ color: string; group: number }>> = [];
  let currentGroup: Array<{ color: string; group: number }> = [];
  let currentLinkGroup = sockets[0].group;

  for (const socket of sockets) {
    if (socket.group !== currentLinkGroup) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [];
      currentLinkGroup = socket.group;
    }
    currentGroup.push(socket);
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

export function SocketChainDisplay({
  sockets,
  isMainGroup = false,
  className,
}: SocketChainDisplayProps) {
  if (!sockets || sockets.length === 0) {
    return null;
  }

  const linkGroups = groupSocketsByLink(sockets);
  const totalLinks = sockets.length;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 px-2.5 py-1.5 rounded-md',
        // Dark metallic background
        'bg-gradient-to-b from-slate-800/80 to-slate-900/90',
        // Subtle border with metallic feel
        'border border-slate-600/40',
        // Inner shadow for depth
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-1px_2px_rgba(0,0,0,0.3)]',
        isMainGroup && 'border-amber-500/40 bg-gradient-to-b from-amber-950/30 to-slate-900/90',
        className
      )}
    >
      {linkGroups.map((group, groupIdx) => (
        <div key={groupIdx} className="flex items-center">
          {group.map((socket, socketIdx) => {
            const style = getSocketStyle(socket.color);
            const isFirst = socketIdx === 0;

            return (
              <div key={socketIdx} className="flex items-center">
                {/* Metallic link bar between sockets */}
                {!isFirst && (
                  <div
                    className={cn(
                      'h-1 w-2 rounded-full mx-0.5',
                      // Metallic gradient for link
                      'bg-gradient-to-r from-slate-500 via-slate-400 to-slate-500',
                      'shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]',
                      isMainGroup && 'from-amber-600 via-amber-400 to-amber-600'
                    )}
                  />
                )}

                {/* Socket orb with gradient and glow */}
                <div
                  className={cn(
                    'w-3 h-3 rounded-full border',
                    style.gradient,
                    style.shadow,
                    style.border,
                    'transition-transform duration-150',
                    'hover:scale-110'
                  )}
                  title={`${socket.color === 'R' ? 'Strength' : socket.color === 'G' ? 'Dexterity' : socket.color === 'B' ? 'Intelligence' : 'White'} socket`}
                />
              </div>
            );
          })}

          {/* Separator between unlinked groups */}
          {groupIdx < linkGroups.length - 1 && (
            <div className="w-2 flex items-center justify-center mx-1">
              <div className="w-1 h-1 rounded-full bg-slate-600/60" />
            </div>
          )}
        </div>
      ))}

      {/* Link count badge */}
      {totalLinks > 1 && (
        <span
          className={cn(
            'ml-1.5 text-[0.5625rem] font-bold tabular-nums',
            'px-1 py-0.5 rounded',
            'bg-slate-700/50 border border-slate-600/30',
            isMainGroup ? 'text-amber-300' : 'text-slate-400'
          )}
        >
          {totalLinks}L
        </span>
      )}
    </div>
  );
}

export default SocketChainDisplay;
