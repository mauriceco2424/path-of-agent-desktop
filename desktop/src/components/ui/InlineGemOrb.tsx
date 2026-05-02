/**
 * InlineGemOrb Component
 *
 * A tiny (16px) gem orb icon for rendering inline within text flow.
 * The gem equivalent of InlineNodeIcon (which renders 14px tree node sprites).
 * Uses a gradient rim matching the gem's socket color with the gem icon inside.
 */

import { useState, useEffect } from 'react';

interface InlineGemOrbProps {
  /** Gem socket color code ('r', 'g', 'b', 'd') */
  color: string;
  /** Individual gem icon URL */
  iconUrl: string;
  /** Gem name for alt text */
  name: string;
}

const RIM_CLASSES: Record<string, string> = {
  r: 'from-red-300 via-red-500 to-red-900',
  g: 'from-emerald-300 via-emerald-500 to-emerald-900',
  b: 'from-sky-300 via-blue-500 to-blue-900',
  d: 'from-slate-200 via-slate-400 to-slate-700',
};

const SHELL_CLASSES: Record<string, string> = {
  r: 'bg-red-950/80',
  g: 'bg-emerald-950/80',
  b: 'bg-blue-950/80',
  d: 'bg-slate-950/85',
};

const DEFAULT_RIM = 'from-sky-300 via-blue-500 to-blue-900';
const DEFAULT_SHELL = 'bg-blue-950/80';

export function InlineGemOrb({ color, iconUrl, name }: InlineGemOrbProps) {
  const [imgError, setImgError] = useState(false);

  // Reset error state when the icon URL changes (e.g., gem lookup resolves after initial render)
  useEffect(() => {
    setImgError(false);
  }, [iconUrl, color]);

  const rim = RIM_CLASSES[color] ?? DEFAULT_RIM;
  const shell = SHELL_CLASSES[color] ?? DEFAULT_SHELL;

  return (
    <span
      className={`inline-block align-middle mr-0.5 -mt-px rounded-full bg-gradient-to-b ${rim} p-px`}
      style={{ width: 16, height: 16 }}
    >
      <span
        className={`flex items-center justify-center rounded-full ${shell}`}
        style={{ width: 14, height: 14 }}
      >
        {!imgError ? (
          <img
            src={iconUrl}
            alt={name}
            style={{ width: 12, height: 12 }}
            className="rounded-full"
            onError={() => setImgError(true)}
          />
        ) : (
          <span
            className={`block rounded-full bg-gradient-to-br ${rim} opacity-60`}
            style={{ width: 8, height: 8 }}
          />
        )}
      </span>
    </span>
  );
}
