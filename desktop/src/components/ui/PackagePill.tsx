/**
 * PackagePill Component
 *
 * Renders a gear package reference as an amber pill with:
 * - Hover: shows a Radix tooltip with full item cards + stat deltas
 *
 * Falls back to a plain pill (no tooltip) if no gear data is found in the store.
 */

import type { ReactNode } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useGearPackage } from '../../store/gearPackageStore';
import { ItemTooltip } from '../visualization/ItemTooltip';

interface PackagePillProps {
  packageRef: string;
  children: ReactNode;
}

const PILL_CLASS = [
  'inline-flex items-center gap-1 cursor-help',
  'px-2 py-0.5 rounded-full text-[0.6875rem] font-medium leading-tight',
  'text-amber-300 bg-amber-900/30 border border-amber-700/40',
  'hover:bg-amber-800/40 hover:text-amber-200 hover:border-amber-600/50',
  'hover:[box-shadow:0_0_8px_rgba(251,191,36,0.15)]',
  'transition-all duration-200',
].join(' ');

/**
 * Scale factor for the tooltip when many items need to fit.
 * Cards stay at 200px, the whole tooltip scales down uniformly.
 */
function getTooltipScale(itemCount: number): number {
  if (itemCount <= 3) return 1;
  if (itemCount === 4) return 0.9;
  return 0.8; // 5+
}

export function PackagePill({ packageRef, children }: PackagePillProps) {
  const pkg = useGearPackage(packageRef);

  const pill = (
    <span className={PILL_CLASS}>
      {children}
    </span>
  );

  // No data available — render plain pill
  if (!pkg || pkg.items.length === 0) {
    return pill;
  }

  const visibleItems = pkg.items.slice(0, 5);
  const scale = getTooltipScale(visibleItems.length);

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
            <div
              className="bg-[#0c0c0e] border border-[#3a3530]/60 rounded-lg p-2.5 shadow-xl origin-bottom"
              style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
            >
              {/* Stat deltas header */}
              {(pkg.dps?.pct || pkg.ehp?.pct) && (
                <div className="flex items-center gap-3 mb-2 px-1 text-xs font-mono">
                  {pkg.dps?.pct && (
                    <span className={parsePct(pkg.dps.pct) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {pkg.dps.pct} DPS
                    </span>
                  )}
                  {pkg.ehp?.pct && (
                    <span className={parsePct(pkg.ehp.pct) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {pkg.ehp.pct} EHP
                    </span>
                  )}
                </div>
              )}

              {/* Item cards — always horizontal, full 200px each */}
              <div className="flex gap-2 justify-center">
                {visibleItems.map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
                    <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-amber-900/20 text-amber-400/70 border border-amber-500/15 font-medium uppercase tracking-wider">
                      {item.slot}
                    </span>
                    <ItemTooltip
                      name={item.name}
                      baseName={item.baseName}
                      rarity={item.rarity}
                      mods={item.mods}
                      raw={item.raw}
                      baseStats={item.baseStats}
                      displayInfo={item.weaponStats ? {
                        itemName: item.name,
                        baseName: item.baseName,
                        isCorrupted: false,
                        influences: [],
                        isFractured: false,
                        weaponStats: item.weaponStats,
                      } : undefined}
                      requirements={item.requirements}
                    />
                  </div>
                ))}
                {pkg.items.length > 5 && (
                  <div className="flex items-center text-[0.625rem] text-stone-500 italic px-2">
                    +{pkg.items.length - 5} more
                  </div>
                )}
              </div>
            </div>
            <Tooltip.Arrow className="fill-[#0c0c0e]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function parsePct(pct: string | undefined): number {
  if (!pct) return 0;
  const cleaned = pct.replace(/[^-+.\d]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}
