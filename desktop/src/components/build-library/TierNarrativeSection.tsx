/**
 * TierNarrativeSection — renders the LLM-written holistic narrative for
 * one tier of a build guide (mechanics + defensive layers + playstyle
 * feel + "what's next" hints).
 *
 * Baked into `TierSnapshot.narrative` at guide-generation time by
 * `narrative-writer.ts` on the backend. Optional — guides generated
 * before the narrative layer landed simply don't render this section.
 *
 * Layout sits ABOVE the equipment/skills/tree viz zone so a reader gets
 * the prose context first, then inspects the loadout. Cross-tier
 * continuity (the optional `continuityFromPrevTier` callout) renders
 * inline at the top so it visually links back to the previous tier
 * the user just clicked away from.
 */

import { motion } from 'framer-motion';
import { BookOpen, Shield, Sword, ChevronRight, ArrowRight } from 'lucide-react';
import type { TierBuildNarrative } from '@shared/types/build-library';
import { SemanticMarkdown } from '../../utils/semantic-markdown';

interface TierNarrativeSectionProps {
  narrative: TierBuildNarrative;
}

export function TierNarrativeSection({ narrative }: TierNarrativeSectionProps) {
  return (
    <motion.section
      key={`narrative-${narrative.tier}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
      className="relative overflow-hidden rounded-xl p-5 sm:p-6"
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
          <BookOpen className="w-3.5 h-3.5 text-amber-300/80" />
          <span className="text-[0.6875rem] font-display font-semibold uppercase tracking-[0.18em] text-amber-300/90">
            How This Tier Plays
          </span>
          <div
            className="flex-1 h-px"
            style={{
              background:
                'linear-gradient(90deg, rgba(251,191,36,0.25) 0%, transparent 100%)',
            }}
          />
        </div>

        {/* Continuity callout — only when the writer linked this tier back to a prior one */}
        {narrative.continuityFromPrevTier && (
          <div
            className="flex items-start gap-3 rounded-lg px-4 py-3"
            style={{
              background:
                'linear-gradient(145deg, rgba(168, 85, 247, 0.07) 0%, rgba(2,6,23,0.45) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.22)',
            }}
          >
            <ArrowRight className="w-4 h-4 text-violet-300/90 mt-0.5 flex-shrink-0" />
            <div className="text-[0.8125rem] text-violet-100/90 leading-relaxed italic">
              <SemanticMarkdown content={narrative.continuityFromPrevTier} />
            </div>
          </div>
        )}

        {/* Mechanics + Defences in a 2-column grid on lg+, stacked below */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <NarrativeBlock
            title="Mechanics"
            Icon={Sword}
            color="#fca5a5"
            body={narrative.mechanicsSummary}
          />
          <NarrativeBlock
            title="Defensive Layers"
            Icon={Shield}
            color="#7dd3fc"
            body={narrative.defensiveLayers}
          />
        </div>

        {/* Playstyle Feel — full-width block under the two columns */}
        <NarrativeBlock
          title="What It Feels Like"
          Icon={BookOpen}
          color="#fcd34d"
          body={narrative.playstyleFeel}
        />

        {/* Progression hints — chip row */}
        {narrative.progressionHints.length > 0 && (
          <div>
            <div className="flex items-center gap-2.5 mb-2.5">
              <div
                className="w-1 h-3.5 rounded-full"
                style={{
                  background:
                    'linear-gradient(180deg, #34d399 0%, rgba(52,211,153,0.6) 100%)',
                }}
              />
              <span className="text-[0.6875rem] font-display font-semibold uppercase tracking-[0.18em] text-emerald-300/90">
                What To Chase Next
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {narrative.progressionHints.map((hint, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.8125rem] text-emerald-100/95"
                  style={{
                    background:
                      'linear-gradient(145deg, rgba(16, 185, 129, 0.08) 0%, rgba(2,6,23,0.5) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.22)',
                  }}
                >
                  <ChevronRight className="w-3 h-3 text-emerald-400/80 flex-shrink-0" />
                  <div className="[&>p]:m-0 [&>p]:inline">
                    <SemanticMarkdown content={hint} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}

interface NarrativeBlockProps {
  title: string;
  Icon: typeof BookOpen;
  color: string;
  body: string;
}

function NarrativeBlock({ title, Icon, color, body }: NarrativeBlockProps) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: `linear-gradient(145deg, ${color}0d 0%, rgba(2,6,23,0.5) 100%)`,
        border: `1px solid ${color}28`,
      }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="w-3.5 h-3.5" style={{ color: `${color}cc` }} />
        <span
          className="text-[0.6875rem] font-display font-semibold uppercase tracking-[0.18em]"
          style={{ color: `${color}dd` }}
        >
          {title}
        </span>
      </div>
      <ProseBody text={body} />
    </div>
  );
}

/**
 * Render multi-paragraph narrative prose. Routes through SemanticMarkdown so
 * that embedded semantic tags (<skill>, <notable>, <keystone>, <unique>,
 * <slot>, <mechanic>, <stat>) render as styled interactive spans with
 * hoverable tooltips — same treatment as analysis output in ChatPage.
 * Paragraphs separated by blank lines become separate <p> tags via
 * ReactMarkdown's default block handling.
 */
function ProseBody({ text }: { text: string }) {
  return (
    <div className="text-[0.875rem] text-slate-200/95 leading-[1.7] space-y-2.5 [&>p]:m-0">
      <SemanticMarkdown content={text} />
    </div>
  );
}
