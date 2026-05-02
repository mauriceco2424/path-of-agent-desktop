/**
 * AtlasPill Component
 *
 * Renders an atlas path reference (AT1, AT2...) as an inline pill with:
 * - Click: highlights suggested nodes on the atlas canvas + switches to atlas tab
 * - Hover: Radix tooltip showing node counts and target names
 *
 * Falls back to a plain pill (no tooltip) if no atlas data is found in the store.
 */

import type { ReactNode } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Map } from 'lucide-react';
import { useAtlasPackage } from '../../store/atlasPackageStore';
import { useDesktopStore } from '../../store';


interface AtlasPillProps {
  packageRef: string;
  children: ReactNode;
}

const PILL_CLASS = [
  'inline-flex items-center gap-1 cursor-pointer',
  'px-2 py-0.5 rounded-full text-[0.6875rem] font-medium leading-tight',
  'text-sky-300 bg-sky-900/25 border border-sky-600/35',
  'hover:bg-sky-800/35 hover:text-sky-200 hover:border-sky-500/50',
  'hover:[box-shadow:0_0_8px_rgba(56,189,248,0.18)]',
  'transition-all duration-200',
].join(' ');

function handleClick(nodes?: number[]) {
  if (!nodes?.length) return;
  const store = useDesktopStore.getState();
  store.setAtlasDiffNodes(nodes);
  // Switch to the atlas tab in the sidebar, then open the fullscreen modal.
  // Both events are dispatched: ChatPage listens for 'switch-to-atlas-tab',
  // AtlasVizTab listens for 'open-atlas-fullscreen'.
  window.dispatchEvent(new CustomEvent('switch-to-atlas-tab'));
  // Small delay so the atlas tab mounts before the modal fires
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('open-atlas-fullscreen'));
  }, 50);
}

export function AtlasPill({ packageRef, children }: AtlasPillProps) {
  const pkg = useAtlasPackage(packageRef);
  const hasNodes = pkg && pkg.suggestedNodes.length > 0;

  const pill = (
    <span
      role="button"
      tabIndex={0}
      className={PILL_CLASS}
      onClick={() => handleClick(pkg?.suggestedNodes)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleClick(pkg?.suggestedNodes);
      }}
    >
      <Map className="w-2.5 h-2.5 flex-shrink-0 opacity-60" />
      {children}
    </span>
  );

  if (!pkg) {
    return pill;
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{pill}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={8}
            className="z-[9999] animate-in fade-in-0 zoom-in-95 duration-150"
            collisionPadding={12}
          >
            <div className="bg-[#0c0c0e] border border-sky-500/25 rounded-lg p-2.5 shadow-xl max-w-[280px]">
              {/* Label */}
              <div className="text-[0.6875rem] font-medium text-sky-200 mb-1.5 leading-snug">
                {pkg.label || packageRef}
              </div>

              {/* Node breakdown */}
              {pkg.breakdown && (
                <div className="flex items-center gap-3 text-[0.625rem]">
                  {pkg.breakdown.keystones > 0 && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                      {pkg.breakdown.keystones} keystone{pkg.breakdown.keystones !== 1 ? 's' : ''}
                    </span>
                  )}
                  {pkg.breakdown.notables > 0 && (
                    <span className="flex items-center gap-1 text-sky-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400/80" />
                      {pkg.breakdown.notables} notable{pkg.breakdown.notables !== 1 ? 's' : ''}
                    </span>
                  )}
                  {pkg.breakdown.travel > 0 && (
                    <span className="flex items-center gap-1 text-slate-400">
                      {pkg.breakdown.travel} travel
                    </span>
                  )}
                </div>
              )}

              {/* Reached targets */}
              {pkg.reachedTargets && pkg.reachedTargets.length > 0 && (
                <div className="mt-1.5 text-[0.5625rem] text-emerald-400/80">
                  → {pkg.reachedTargets.join(', ')}
                </div>
              )}

              {/* Click hint */}
              {hasNodes && (
                <div className="mt-1.5 text-[0.5625rem] text-slate-500 italic">
                  Click to show on atlas tree
                </div>
              )}
            </div>
            <Tooltip.Arrow className="fill-[#0c0c0e]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
