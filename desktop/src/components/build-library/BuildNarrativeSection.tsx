/**
 * BuildNarrativeSection — renders the authored build-level narrative at the
 * top of a guide detail page, above the tier picker. Tier-agnostic sibling
 * of TierNarrativeSection.
 *
 * Style follows Maxroll guide intros: a hooky second-person pitch and a
 * strengths/weaknesses split so a reader scanning the library can decide
 * whether this build sounds fun for them. Dense mechanics/defences prose
 * lives in the per-tier narrative below, not here.
 *
 * Populated by `merge-narratives.ts` from the root `buildNarrative` key of
 * the authored `_narratives/{slug}.json` file. Optional on the guide —
 * guides that haven't been re-merged under the new schema skip it.
 */

import { motion } from 'framer-motion';
import { Flame, ThumbsUp, AlertTriangle } from 'lucide-react';
import type { BuildNarrative } from '@shared/types/build-library';
import { SemanticMarkdown } from '../../utils/semantic-markdown';

interface BuildNarrativeSectionProps {
  narrative: BuildNarrative;
}

export function BuildNarrativeSection({ narrative }: BuildNarrativeSectionProps) {
  // Tolerate old-shape guides still in the cache or on the server: if the
  // authored pitch/strengths/weaknesses aren't present, skip the block
  // entirely rather than crashing. Republishing all guides under the new
  // shape will make this unreachable.
  if (!narrative?.pitch) return null;
  const strengths = narrative.strengths ?? [];
  const weaknesses = narrative.weaknesses ?? [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: 0.1 }}
      className="relative overflow-hidden rounded-xl p-5 sm:p-6 mb-8"
      style={{
        background:
          'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.92) 40%, rgba(8,15,35,0.96) 100%)',
        border: '1px solid rgba(251, 191, 36, 0.18)',
        boxShadow:
          '0 8px 32px rgba(0,0,0,0.45), 0 0 40px rgba(251,191,36,0.04), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 8%, rgba(251,191,36,0.18) 25%, rgba(251,191,36,0.45) 50%, rgba(251,191,36,0.18) 75%, transparent 92%)',
        }}
      />

      <div className="relative z-10 space-y-5">
        {/* Section header */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-1 h-4 rounded-full"
            style={{
              background:
                'linear-gradient(180deg, #fbbf24 0%, rgba(251,191,36,0.6) 100%)',
            }}
          />
          <Flame className="w-3.5 h-3.5 text-amber-300/80" />
          <span className="text-[0.6875rem] font-display font-semibold uppercase tracking-[0.18em] text-amber-300/90">
            How This Build Plays
          </span>
          <div
            className="flex-1 h-px"
            style={{
              background:
                'linear-gradient(90deg, rgba(251,191,36,0.25) 0%, transparent 100%)',
            }}
          />
        </div>

        {/* Pitch — light, hooky, second-person. Full width. */}
        <div className="text-[0.9375rem] text-slate-200/95 leading-[1.75] [&>p]:m-0 [&>p+p]:mt-3">
          <SemanticMarkdown content={narrative.pitch} />
        </div>

        {/* Strengths + Weaknesses in a 2-column grid on lg+, stacked below */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BulletBlock
            title="Strengths"
            Icon={ThumbsUp}
            color="#86efac"
            items={strengths}
          />
          <BulletBlock
            title="Weaknesses"
            Icon={AlertTriangle}
            color="#fca5a5"
            items={weaknesses}
          />
        </div>
      </div>
    </motion.section>
  );
}

interface BulletBlockProps {
  title: string;
  Icon: typeof ThumbsUp;
  color: string;
  items: string[];
}

function BulletBlock({ title, Icon, color, items }: BulletBlockProps) {
  if (!items || items.length === 0) return null;
  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: `linear-gradient(145deg, ${color}0d 0%, rgba(2,6,23,0.5) 100%)`,
        border: `1px solid ${color}28`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-3.5 h-3.5" style={{ color: `${color}cc` }} />
        <span
          className="text-[0.6875rem] font-display font-semibold uppercase tracking-[0.18em]"
          style={{ color: `${color}dd` }}
        >
          {title}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, idx) => (
          <li
            key={idx}
            className="flex items-start gap-2 text-[0.8125rem] text-slate-200/95 leading-[1.55]"
          >
            <span
              className="mt-[0.4em] h-1 w-1 rounded-full flex-shrink-0"
              style={{ background: `${color}bb` }}
            />
            <div className="[&>p]:m-0 [&>p]:inline">
              <SemanticMarkdown content={item} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
