/**
 * AscendancyEmblem — renders the ornate class medallion for a given
 * ascendancy using the `ascendancy` sprite sheet from tree-latest.json.
 *
 * The tree data ships one sheet per zoom level (0.1246 → 0.5). Each sheet
 * contains all 21 class emblems keyed as `Classes<Name>` (see
 * ascendancy-meta.ts for the remap — notably `Warden → ClassesRaider`).
 *
 * Rendering trick: we embed an `<img>` of the full sheet, clip it via a
 * fixed-size parent with `overflow: hidden`, then scale + translate so the
 * requested tile fills the viewport. This avoids needing to know the
 * sheet's natural dimensions up-front (which `background-size` would
 * require to scale correctly).
 *
 * Fallback: a tarnished bronze placeholder containing the first letter of
 * the ascendancy name in Cinzel, used when tree data or the sprite key is
 * unavailable.
 */

import { useMemo } from 'react';
import { useTreeData } from '../visualization/tree/hooks/useTreeData';
import { getAccent, getSpriteKey } from './ascendancy-meta';

interface AscendancyEmblemProps {
  ascendancy: string;
  /** Rendered width/height in px (emblem is square). */
  size?: number;
  className?: string;
}

/**
 * Pick the cheapest sprite sheet zoom that still covers `size` at ~2× for
 * crisp rendering. Emblem is ~650×650 at zoom 0.5, so at 0.1246 the source
 * tile is ~162px, already enough for 64px display.
 */
function pickZoomLevel(available: string[], size: number): string {
  const target = size * 2;
  const sorted = available
    .map((k) => ({ key: k, zoom: parseFloat(k), tileSize: 650 * parseFloat(k) }))
    .sort((a, b) => a.zoom - b.zoom);
  const match = sorted.find((s) => s.tileSize >= target);
  return (match ?? sorted[sorted.length - 1]).key;
}

export function AscendancyEmblem({
  ascendancy,
  size = 64,
  className,
}: AscendancyEmblemProps) {
  const { data } = useTreeData();
  const accent = getAccent(ascendancy);
  const spriteKey = getSpriteKey(ascendancy);

  const sprite = useMemo(() => {
    if (!data?.sprites?.ascendancy || !spriteKey) return null;
    const zoomMap = data.sprites.ascendancy as Record<
      string,
      { filename: string; coords: Record<string, { x: number; y: number; w: number; h: number }> }
    >;
    const zoomKey = pickZoomLevel(Object.keys(zoomMap), size);
    const sheet = zoomMap[zoomKey];
    const coord = sheet?.coords?.[spriteKey];
    if (!sheet || !coord) return null;
    return {
      filename: sheet.filename,
      coord,
      scale: size / coord.w,
    };
  }, [data, spriteKey, size]);

  // Fallback glyph when sprite data isn't ready or ascendancy is unknown.
  // Tarnished bronze placeholder — first letter of the ascendancy in Cinzel.
  if (!sprite) {
    const initial = ascendancy?.charAt(0).toUpperCase() ?? '?';
    return (
      <div
        className={`${className ?? ''} font-display`.trim()}
        style={{
          width: size,
          height: size,
          borderRadius: '0.125rem',
          background: 'linear-gradient(135deg, #0f172a 0%, #000000 100%)',
          border: '1px solid rgba(146, 64, 14, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 1px 0 rgba(251, 191, 36, 0.06), 0 2px 6px rgba(0, 0, 0, 0.5)',
          color: 'rgba(245, 158, 11, 0.7)',
          fontSize: size * 0.45,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        {initial}
      </div>
    );
  }

  const { filename, coord, scale } = sprite;
  // Transform order is right-to-left: scale first (origin top-left), then translate.
  // After scale(), the sheet is (naturalW*scale) × (naturalH*scale) and the tile
  // we want sits at (coord.x*scale, coord.y*scale). Translate by the negative of
  // that to bring the tile to (0,0).
  const transform = `translate(${-coord.x * scale}px, ${-coord.y * scale}px) scale(${scale})`;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative',
        background: `radial-gradient(circle at 50% 50%, ${accent.glow} 0%, rgba(2,6,23,0.8) 75%)`,
        boxShadow: `0 0 ${size * 0.22}px ${accent.glow}, inset 0 0 0 1px ${accent.accent}55`,
      }}
    >
      <img
        src={filename}
        alt=""
        aria-hidden
        draggable={false}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          // Tailwind preflight sets `img { max-width: 100% }`, which would cap
          // the sheet to the 52px parent width *before* scale() applies and
          // break the transform math. Force the image to its natural size.
          maxWidth: 'none',
          width: 'auto',
          height: 'auto',
          transformOrigin: 'top left',
          transform,
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
