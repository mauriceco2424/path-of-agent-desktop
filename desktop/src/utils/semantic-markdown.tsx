/**
 * SemanticMarkdown Component
 *
 * Renders markdown content with LLM-generated semantic highlighting.
 * The LLM wraps PoE terms in semantic tags that are converted to colored spans:
 *
 * - <skill>...</skill> -> blue (skill gems, support gems)
 * - <notable>...</notable> -> purple (tree notables, keystones, ascendancy nodes)
 * - <stat>...</stat> -> green (numbers+stats, mod tiers, stat keywords)
 * - <slot>...</slot> -> amber (equipment slots)
 * - <mechanic>...</mechanic> -> red (game mechanics)
 * - <trade url="...">text</trade> -> teal pill linking to trade search
 * - <simresult ref="tool_name">text</simresult> -> gold pill that scrolls to tool result
 *
 * Usage:
 *   <SemanticMarkdown content={markdownString} className="prose prose-invert" />
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { ExternalLink, ArrowUpRight } from 'lucide-react';
import { openExternal } from './open-external';
import { EntitySpan } from '../components/ui/EntitySpan';
import { PackagePill } from '../components/ui/PackagePill';
import { TreePill } from '../components/ui/TreePill';
import { AtlasPill } from '../components/ui/AtlasPill';
import { inferPathwayFromToolName } from './navigate-to-ref';
import { useDesktopStore } from '../store';
import type { AnalysisFocus } from '../types/chat-modes';
import type { PathwayType } from '../store';

interface SemanticMarkdownProps {
  content: string;
  className?: string;
  /** Pathway context (used for cross-tab navigation on simresult pills). */
  pathway?: string;
}

/**
 * TailwindCSS color classes for each semantic tag type.
 * Uses a two-tier hierarchy for visual clarity:
 * - Tier 1 (vivid): stat, mechanic - critical info users need to notice
 * - Tier 2 (softer): skill, notable, slot - supplementary context
 */
const TAG_STYLES: Record<string, string> = {
  // GOLD - stats (numbers, DPS, life, resistances) - brightest, strongest glow
  stat: 'text-yellow-300 font-bold [text-shadow:0_0_8px_rgba(253,224,71,0.5)]',

  // DEEP ORANGE - mechanics (bleed, poison, fortify, leech)
  mechanic: 'text-orange-400 font-semibold [text-shadow:0_0_6px_rgba(251,146,60,0.4)]',

  // BLUE - skills (gem names, supports) - cool blue with soft glow
  skill: 'text-sky-300 font-medium [text-shadow:0_0_6px_rgba(125,211,252,0.4)]',

  // GREEN - notables and keystones (tree nodes, ascendancy) - vivid green glow
  notable: 'text-emerald-400 font-semibold [text-shadow:0_0_6px_rgba(52,211,153,0.4)]',
  keystone: 'text-emerald-400 font-semibold [text-shadow:0_0_6px_rgba(52,211,153,0.4)]',

  // PALE/BEIGE - slots (gear references) - very subtle glow, italic
  slot: 'text-stone-300 italic [text-shadow:0_0_3px_rgba(214,211,209,0.25)]',

  // UNIQUE ORANGE - unique items (PoE unique item color)
  unique: 'text-[#af6025] font-semibold [text-shadow:0_0_5px_rgba(175,96,37,0.4)]',

  // RED/ROSE - capability gaps (dev visibility: things the LLM wants to test but no tool exists)
  gap: 'text-rose-400 font-semibold [text-shadow:0_0_6px_rgba(251,113,133,0.5)]',
};

/**
 * Pre-process content to convert LLM semantic tags to styled spans.
 *
 * Converts: <skill>Determination</skill>
 * To: <span class="text-blue-400">Determination</span>
 *
 * This runs BEFORE markdown parsing, so the spans are treated as raw HTML
 * and preserved by rehype-raw.
 */
function parseLLMSemanticTags(content: string): string {
  let result = content;

  // Parse <package ref="XX">text</package> into interactive pills.
  // GR refs → gear package pill (amber), TR refs → tree pill (purple), others → plain text.
  const PACKAGE_RE = /<package\s+ref="([^"]+)">([\s\S]*?)<\/package>/gi;
  result = result.replace(PACKAGE_RE, (_, ref: string, text: string) => {
    if (ref.startsWith('GR')) {
      return `<span data-package-ref="${ref}" class="package-pill">${text}</span>`;
    }
    if (ref.startsWith('TR')) {
      return `<span data-tree-ref="${ref}" class="tree-pill">${text}</span>`;
    }
    return text;
  });

  // Parse <atlasref ref="AT1">text</atlasref> into atlas path pill (sky blue).
  const ATLASREF_RE = /<atlasref\s+ref="([^"]+)">([\s\S]*?)<\/atlasref>/gi;
  result = result.replace(ATLASREF_RE, (_, ref: string, text: string) => {
    return `<span data-atlas-ref="${ref}" class="atlas-pill">${text}</span>`;
  });

  // Parse <simresult ref="tool_name" call="N">text</simresult> into clickable pill that scrolls to tool result
  const SIMRESULT_RE = /<simresult\s+ref="([^"]+)"(?:\s+call="([^"]*)")?\s*>([\s\S]*?)<\/simresult>/gi;
  result = result.replace(SIMRESULT_RE, (_, ref: string, call: string | undefined, text: string) => {
    const callAttr = call ? ` data-simresult-call="${call}"` : '';
    return `<span data-simresult-ref="${ref}"${callAttr} class="simresult-pill">${text}</span>`;
  });

  // Parse <trade url="...">text</trade> BEFORE other tags.
  // Converts to a span with data-trade-url so ReactMarkdown + rehype-raw preserves it,
  // and the custom span component below can render it as a clickable pill.
  const TRADE_RE = /<trade\s+url="([^"]+)">([\s\S]*?)<\/trade>/gi;
  result = result.replace(TRADE_RE, (_, url: string, text: string) => {
    return `<span data-trade-url="${url}" class="trade-pill">${text}</span>`;
  });

  // Parse <notable effect="...">text</notable> BEFORE generic tags.
  // Carries the LLM-recommended mastery effect into a data attribute so the
  // MasterySpan tooltip can show which specific effect the agent is suggesting.
  const NOTABLE_EFFECT_RE = /<notable\s+effect="([^"]+)">([\s\S]*?)<\/notable>/gi;
  result = result.replace(NOTABLE_EFFECT_RE, (_, effect: string, text: string) => {
    const entityName = text.replace(/<[^>]+>/g, '').trim().replace(/[\u2018\u2019]/g, "'");
    const style = TAG_STYLES['notable'];
    return `<span class="${style}" data-entity-type="notable" data-entity-name="${encodeURIComponent(entityName)}" data-entity-effect="${encodeURIComponent(effect)}">${text}</span>`;
  });

  // Match semantic tags: <type>content</type>
  // Using [\s\S]*? to match content across newlines (non-greedy)
  // Loop to handle nested tags (e.g. <stat><skill>text</skill></stat>)
  const TAG_RE = /<(skill|notable|keystone|stat|slot|mechanic|unique|gap)>([\s\S]*?)<\/\1>/gi;

  // Tags that support interactive tooltips (EntitySpan dispatch)
  const INTERACTIVE_TAGS = new Set(['notable', 'keystone', 'skill', 'unique']);

  let prev: string;
  do {
    prev = result;
    result = result.replace(TAG_RE, (_, type: string, text: string) => {
      const ltype = type.toLowerCase();
      const style = TAG_STYLES[ltype];
      if (!style) return text;

      if (INTERACTIVE_TAGS.has(ltype)) {
        // Strip any inner HTML tags to get the plain entity name.
        // Normalize curly/smart quotes to ASCII — LLMs often output U+2018/U+2019
        // but lookup maps (tree nodes, gems, uniques) use straight apostrophes.
        const entityName = text.replace(/<[^>]+>/g, '').trim().replace(/[\u2018\u2019]/g, "'");
        return `<span class="${style}" data-entity-type="${ltype}" data-entity-name="${encodeURIComponent(entityName)}">${text}</span>`;
      }

      return `<span class="${style}">${text}</span>`;
    });
  } while (result !== prev);

  // Safety net: strip ANY remaining custom tags that the regexes above didn't convert.
  // This catches edge cases like: single-quoted attributes, malformed nesting,
  // streaming chunk boundaries, or attribute variations the LLM may produce.
  // Opening tags (with optional attributes) are removed, keeping inner text.
  // Closing tags are simply removed. This prevents React from trying to render
  // <package>, <skill>, <stat>, etc. as HTML elements (which causes crashes,
  // especially <package ref="..."> since React interprets `ref` as a React ref prop).
  const CUSTOM_TAGS = 'skill|notable|keystone|stat|slot|mechanic|unique|gap|package|trade|simresult|atlasref';
  const LEFTOVER_OPEN_RE = new RegExp(`<(${CUSTOM_TAGS})\\b[^>]*>`, 'gi');
  const LEFTOVER_CLOSE_RE = new RegExp(`</(${CUSTOM_TAGS})>`, 'gi');
  result = result.replace(LEFTOVER_OPEN_RE, '');
  result = result.replace(LEFTOVER_CLOSE_RE, '');

  return result;
}

/**
 * Custom ReactMarkdown components.
 * Since semantic highlighting is now handled via pre-processed HTML spans,
 * these components just provide standard structure.
 */
const semanticComponents: Components = {
  // Code - preserve as-is (don't highlight code blocks)
  code: ({ children, className }) => (
    <code className={className}>{children}</code>
  ),

  // Links - use openExternal instead of native <a> navigation (Tauri can't open target="_blank")
  a: ({ children, href }) => (
    <span
      role="link"
      tabIndex={0}
      className="text-teal-400 underline decoration-teal-400/40 hover:text-teal-300 hover:decoration-teal-300/60 cursor-pointer transition-colors duration-150"
      onClick={() => {
        if (href) void openExternal(href);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && href) void openExternal(href);
      }}
    >
      {children}
    </span>
  ),

  // Span - default pass-through, but intercept package pills and trade pills
  span: ({ children, node, ...rest }) => {
    const packageRef = node?.properties?.['dataPackageRef'] as string | undefined;
    if (packageRef) {
      return (
        <PackagePill packageRef={packageRef}>
          {children}
        </PackagePill>
      );
    }

    const treeRef = node?.properties?.['dataTreeRef'] as string | undefined;
    if (treeRef) {
      return (
        <TreePill packageRef={treeRef}>
          {children}
        </TreePill>
      );
    }

    const atlasRef = node?.properties?.['dataAtlasRef'] as string | undefined;
    if (atlasRef) {
      return (
        <AtlasPill packageRef={atlasRef}>
          {children}
        </AtlasPill>
      );
    }

    const simresultRef = node?.properties?.['dataSimresultRef'] as string | undefined;
    if (simresultRef) {
      const simresultCall = node?.properties?.['dataSimresultCall'] as string | undefined;
      const handleClick = () => {
        let el: HTMLElement | null = null;
        if (simresultCall) {
          // Try exact match with call number
          const exactMatch = document.querySelector(`[data-tool-name="${simresultRef}"][data-call-number="${simresultCall}"]`);
          el = exactMatch as HTMLElement | null;
        }
        if (!el) {
          // Fallback: last match (backward compatible)
          const matches = document.querySelectorAll(`[data-tool-name="${simresultRef}"]`);
          el = matches.length > 0 ? matches[matches.length - 1] as HTMLElement : null;
        }
        // Helper: after expand-tool-step, poll until result rows render then scroll to card
        const expandAndScrollToCard = (card: HTMLElement) => {
          card.dispatchEvent(new CustomEvent('expand-tool-step', { bubbles: true }));
          // Poll for result rows to appear (detail view renders async)
          let pollRetries = 0;
          const MAX_POLL = 15;
          function pollRows() {
            const rows = card.querySelectorAll<HTMLElement>('[data-ref]');
            if (rows.length > 0) {
              card.scrollIntoView({ behavior: 'smooth', block: 'start' });
              card.classList.add('ring-2', 'ring-yellow-400/60');
              setTimeout(() => card.classList.remove('ring-2', 'ring-yellow-400/60'), 2000);
              return;
            }
            pollRetries++;
            if (pollRetries < MAX_POLL) {
              requestAnimationFrame(pollRows);
            } else {
              // Rows never appeared — still scroll to the card
              card.scrollIntoView({ behavior: 'smooth', block: 'center' });
              card.classList.add('ring-2', 'ring-yellow-400/60');
              setTimeout(() => card.classList.remove('ring-2', 'ring-yellow-400/60'), 2000);
            }
          }
          requestAnimationFrame(pollRows);
        };

        if (el) {
          expandAndScrollToCard(el);
          return;
        }

        // Cross-tab fallback: infer pathway from tool name and switch tabs
        console.log(`[nav] simresult pill: "${simresultRef}" call=${simresultCall} not found on current tab, trying cross-tab`);
        const pathway = inferPathwayFromToolName(simresultRef);
        if (pathway) {
          const store = useDesktopStore.getState();
          store.setActivePathwayTab(pathway as AnalysisFocus);
          if (pathway !== 'synthesis') {
            store.setActivePathway(pathway as PathwayType);
          }

          let retries = 0;
          const MAX_RETRIES = 10;
          function poll() {
            let target: HTMLElement | null = null;
            if (simresultCall) {
              const exactMatch = document.querySelector(`[data-tool-name="${simresultRef}"][data-call-number="${simresultCall}"]`);
              target = exactMatch as HTMLElement | null;
            }
            if (!target) {
              const matches = document.querySelectorAll(`[data-tool-name="${simresultRef}"]`);
              target = matches.length > 0 ? matches[matches.length - 1] as HTMLElement : null;
            }
            if (target) {
              expandAndScrollToCard(target);
              return;
            }
            retries++;
            if (retries < MAX_RETRIES) {
              requestAnimationFrame(poll);
            }
          }
          requestAnimationFrame(poll);
        }
      };
      return (
        <span
          role="link"
          tabIndex={0}
          className={[
            'inline-flex items-center gap-1 cursor-pointer',
            'px-2 py-0.5 rounded-full text-[0.6875rem] font-bold leading-tight',
            'text-yellow-300 bg-yellow-900/25 border border-yellow-600/40',
            '[text-shadow:0_0_6px_rgba(253,224,71,0.4)]',
            'hover:bg-yellow-800/35 hover:text-yellow-200 hover:border-yellow-500/50',
            'hover:[box-shadow:0_0_10px_rgba(253,224,71,0.2)]',
            'transition-all duration-200',
          ].join(' ')}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleClick();
          }}
        >
          {children}
          <ArrowUpRight className="w-2.5 h-2.5 flex-shrink-0 opacity-70" />
        </span>
      );
    }

    const tradeUrl = node?.properties?.['dataTradeUrl'] as string | undefined;

    if (tradeUrl) {
      return (
        <span
          role="link"
          tabIndex={0}
          className={[
            'inline-flex items-center gap-1 cursor-pointer',
            'px-2 py-0.5 rounded-full text-[0.6875rem] font-medium leading-tight',
            'text-teal-300 bg-teal-900/30 border border-teal-700/40',
            'hover:bg-teal-800/40 hover:text-teal-200 hover:border-teal-600/50',
            'hover:[box-shadow:0_0_8px_rgba(94,234,212,0.15)]',
            'transition-all duration-200',
          ].join(' ')}
          onClick={() => void openExternal(tradeUrl)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void openExternal(tradeUrl);
          }}
        >
          {children}
          <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-70" />
        </span>
      );
    }

    // Check for interactive entity spans (notable, skill, unique)
    const entityType = node?.properties?.['dataEntityType'] as string | undefined;
    const encodedName = node?.properties?.['dataEntityName'] as string | undefined;
    if (entityType && encodedName) {
      const entityName = decodeURIComponent(encodedName);
      const encodedEffect = node?.properties?.['dataEntityEffect'] as string | undefined;
      const entityEffect = encodedEffect ? decodeURIComponent(encodedEffect) : undefined;
      const { className: cls } = rest as { className?: string };
      return (
        <EntitySpan entityType={entityType} entityName={entityName} entityEffect={entityEffect} className={cls}>
          {children}
        </EntitySpan>
      );
    }

    // Default span rendering - preserve className and other attributes
    const { className } = rest as { className?: string };
    return <span className={className}>{children}</span>;
  },
};

/**
 * SemanticMarkdown component - renders markdown with LLM-generated semantic highlighting.
 */
export function SemanticMarkdown({ content, className = '', pathway }: SemanticMarkdownProps) {
  if (!content) return null;

  // Pre-process content to convert semantic tags to styled spans
  const processedContent = parseLLMSemanticTags(content);

  return (
    <div className={className}>
      <ReactMarkdown rehypePlugins={[rehypeRaw]} components={semanticComponents}>
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

export default SemanticMarkdown;
