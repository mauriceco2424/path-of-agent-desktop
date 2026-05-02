/**
 * Pathway Parser Utility
 *
 * Parses HTML pathway cards from initial analysis response.
 * Supports two formats:
 * - Legacy format: STRENGTHS/WEAKNESSES sections
 * - New format: action-item divs with priority/category attributes
 *
 * Cards are returned in array order (Gear -> Skills -> Tree) as sent by backend.
 */

import type {
  ParsedPathwayCard,
  ParsedGeneralAssessment,
  PathwayType,
  ActionItem,
  ActionCategory,
  CategoryAssessment,
  ActionType,
} from '../store';
import type { ActionButtonType, ExploreOption } from '../../../shared/types/improvements';

/**
 * Parse pathway cards from the initial analysis HTML response.
 *
 * Expected HTML format (new format with nested category divs):
 * ```html
 * <div class="pathway pathway-skills">
 *   <div class="pathway-header">
 *     <svg class="pathway-icon" ...>...</svg>
 *     <span class="pathway-pillar">SKILLS</span>
 *     <span class="pathway-title">Title Here</span>
 *   </div>
 *   <div class="pathway-body">
 *     <div class="pathway-strengths">
 *       <strong>STRENGTHS</strong>
 *       <div class="category-offensive">...</div>
 *       <div class="category-defensive">...</div>
 *       <div class="category-utility">...</div>
 *     </div>
 *     <div class="pathway-weaknesses">...</div>
 *     <p class="pathway-cta">Explore improvements &rarr;</p>
 *   </div>
 * </div>
 * ```
 *
 *
 * Note: Cards are returned in array order as received from backend (Gear -> Skills -> Tree).
 * No priority sorting is applied.
 */
export function parsePathwayCards(html: string): ParsedPathwayCard[] {
  const cards: ParsedPathwayCard[] = [];

  // Match each pathway div - structure uses CTA paragraph as anchor to handle nested divs:
  // <div class="pathway pathway-X">
  //   <div class="pathway-header">...</div>
  //   <div class="pathway-body">
  //     <div class="pathway-strengths">...(nested category divs)...</div>
  //     <div class="pathway-weaknesses">...</div>
  //     <p class="pathway-cta">...</p>  <-- anchor point
  //   </div>
  // </div>
  // The CTA paragraph is always present and is the last element before closing divs
  const pathwayRegex = /<div class="pathway pathway-(skills|tree|gear)">\s*<div class="pathway-header">([\s\S]*?)<\/div>\s*<div class="pathway-body">([\s\S]*?)<p class="pathway-cta">[\s\S]*?<\/p>\s*<\/div>\s*<\/div>/g;

  let match;
  let matchCount = 0;
  while ((match = pathwayRegex.exec(html)) !== null) {
    matchCount++;
    const pathwayType = match[1] as PathwayType;
    const headerContent = match[2];
    const bodyContent = match[3];

    const card = parsePathwayContent(pathwayType, headerContent, bodyContent);
    if (card) {
      cards.push(card);
    }
  }

  // Return cards in array order as received from backend (no sorting)
  return cards;
}

/**
 * Parse the content of a single pathway div.
 * Supports both legacy format (strengths/weaknesses) and new format (action items).
 *
 * @param type - The pathway type (skills, tree, gear)
 * @param headerContent - Content inside pathway-header div
 * @param bodyContent - Content inside pathway-body div
 */
function parsePathwayContent(
  type: PathwayType,
  headerContent: string,
  bodyContent: string
): ParsedPathwayCard | null {
  // Extract pillar label from header
  const pillarMatch = headerContent.match(/<span class="pathway-pillar">([^<]+)<\/span>/);
  const pillar = pillarMatch ? pillarMatch[1].trim() : type.toUpperCase();

  // Extract title from header
  const titleMatch = headerContent.match(/<span class="pathway-title">([^<]+)<\/span>/);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Extract the entire SVG element from header
  // Try multiple patterns: with or without class attribute, quotes variations
  let iconSvg = getDefaultIcon(type);
  const svgPatterns = [
    /<svg class="pathway-icon"[^>]*>[\s\S]*?<\/svg>/,
    /<svg class='pathway-icon'[^>]*>[\s\S]*?<\/svg>/,
    /<svg[^>]*class="pathway-icon"[^>]*>[\s\S]*?<\/svg>/,
    /<svg[^>]*>[\s\S]*?<\/svg>/  // Fallback: any SVG in the header
  ];

  for (const pattern of svgPatterns) {
    const match = headerContent.match(pattern);
    if (match) {
      iconSvg = match[0];
      break;
    }
  }

  // Try to extract action items (new format)
  const actions = extractActionItems(bodyContent);

  // Extract legacy format sections
  const strengths = extractPathwaySection(bodyContent, 'good');
  const weaknesses = extractPathwaySection(bodyContent, 'improve');

  // Validate we have minimum required data
  // New format: title + actions
  // Legacy format: title + strengths + weaknesses
  const hasNewFormat = actions.length > 0;
  const hasLegacyFormat = !!strengths && !!weaknesses;

  if (!title || (!hasNewFormat && !hasLegacyFormat)) {
    return null;
  }

  return {
    type,
    pillar,
    title,
    iconSvg,
    // Include legacy fields if present (backwards compatibility)
    strengths: strengths || undefined,
    weaknesses: weaknesses || undefined,
    // Always include actions array (empty for legacy format)
    actions,
  };
}

/**
 * Extract action items from pathway body content.
 *
 * Expected HTML format for action items (unified format):
 * ```html
 * <div class="action-item"
 *      data-priority="1"
 *      data-category="offensive"
 *      data-slot="helmet"
 *      data-action-type="trade">
 *   <span class="action-title">Title text</span>
 *   <span class="action-impact">Impact description</span>
 *   <span class="action-evidence">Evidence text</span>
 * </div>
 * ```
 *
 * @param bodyContent - The pathway-body div content
 * @returns Array of ActionItem objects, sorted by priority
 */
export function extractActionItems(bodyContent: string): ActionItem[] {
  const items: ActionItem[] = [];

  // Match action-item divs - capture the full opening tag and content
  // This regex captures the entire div element to extract all data attributes
  const actionDivRegex = /<div\s+class="action-item"([^>]*)>([\s\S]*?)<\/div>/g;

  let match;
  let itemIndex = 0;

  while ((match = actionDivRegex.exec(bodyContent)) !== null) {
    const attributes = match[1];
    const content = match[2];

    // Extract data-priority
    const priorityMatch = attributes.match(/data-priority="(\d+)"/);
    const priority = priorityMatch ? parseInt(priorityMatch[1], 10) : itemIndex + 1;

    // Extract data-category (supports comma-separated multi-category)
    const categoryMatch = attributes.match(/data-category="([^"]+)"/);
    const rawCategoryValues = categoryMatch
      ? categoryMatch[1].split(',').map((value) => value.trim())
      : [];
    const validCategories = ['offensive', 'defensive', 'utility'] as const;
    const categoryValues = rawCategoryValues.filter(
      (value): value is ActionCategory =>
        value === 'offensive' || value === 'defensive' || value === 'utility'
    );

    // Log warning if any categories were filtered out
    if (rawCategoryValues.length > 0 && categoryValues.length < rawCategoryValues.length) {
      const droppedCategories = rawCategoryValues.filter(
        (value) => !validCategories.includes(value as ActionCategory)
      );
      console.warn(
        `[pathway-parser] Action item dropped ${droppedCategories.length} invalid category value(s): ${droppedCategories.join(', ')}. Valid categories are: ${validCategories.join(', ')}`
      );
    }

    const categories: ActionCategory[] =
      categoryValues.length > 0 ? categoryValues : ['utility'];
    const category = categories[0];

    // Extract data-slot (optional, may be empty string)
    const slotMatch = attributes.match(/data-slot="([^"]*)"/);
    const slot = slotMatch ? slotMatch[1] : undefined;

    // Extract data-action-type (optional, defaults to 'both')
    const actionTypeMatch = attributes.match(/data-action-type="(trade|craft|both|respec)"/);
    const actionType = (actionTypeMatch ? actionTypeMatch[1] : 'both') as ActionType;

    // Extract confidence tier data attributes (new)
    const confidenceTierMatch = attributes.match(/data-confidence-tier="(verified|meta-backed|utility)"/);
    const confidenceTier = confidenceTierMatch ? confidenceTierMatch[1] as 'verified' | 'meta-backed' | 'utility' : undefined;

    const canSimulateMatch = attributes.match(/data-can-simulate="(true|false)"/);
    const canSimulate = canSimulateMatch ? canSimulateMatch[1] === 'true' : undefined;

    const simulationNoteMatch = attributes.match(/data-simulation-note="([^"]*)"/);
    const simulationNote = simulationNoteMatch && simulationNoteMatch[1] ? simulationNoteMatch[1] : undefined;

    const skillGroupIndexMatch = attributes.match(/data-skill-group-index="([^"]*)"/);
    const parsedSkillGroupIndex = skillGroupIndexMatch && skillGroupIndexMatch[1]
      ? Number(skillGroupIndexMatch[1])
      : undefined;
    const skillGroupIndex = Number.isFinite(parsedSkillGroupIndex)
      ? parsedSkillGroupIndex
      : undefined;

    const skillGroupLabelMatch = attributes.match(/data-skill-group-label="([^"]*)"/);
    const skillGroupLabel = skillGroupLabelMatch && skillGroupLabelMatch[1]
      ? skillGroupLabelMatch[1]
      : undefined;

    const skillGroupSlotMatch = attributes.match(/data-skill-group-slot="([^"]*)"/);
    const skillGroupSlot = skillGroupSlotMatch && skillGroupSlotMatch[1]
      ? skillGroupSlotMatch[1]
      : undefined;

    const skillGroupMainMatch = attributes.match(/data-skill-group-main="(true|false)"/);
    const skillGroupIsMain = skillGroupMainMatch
      ? skillGroupMainMatch[1] === 'true'
      : undefined;

    const skillGroupTagMatch = attributes.match(/data-skill-group-tag="([^"]*)"/);
    const skillGroupTag = skillGroupTagMatch && skillGroupTagMatch[1]
      ? skillGroupTagMatch[1]
      : undefined;

    // Extract suggestedActions (Spec 039) - comma-separated list of action button types
    const suggestedActionsMatch = attributes.match(/data-suggested-actions="([^"]*)"/);
    const suggestedActionsRaw = suggestedActionsMatch ? suggestedActionsMatch[1] : '';
    const suggestedActions: ActionButtonType[] | undefined = suggestedActionsRaw
      ? suggestedActionsRaw.split(',').filter((s): s is ActionButtonType =>
          ['analyze', 'apply', 'trade', 'craft', 'explore'].includes(s)
        )
      : undefined;

    // Extract exploreOptions (Spec 039) - URL-encoded JSON array
    const exploreOptionsMatch = attributes.match(/data-explore-options="([^"]*)"/);
    let exploreOptions: ExploreOption[] | undefined;
    if (exploreOptionsMatch && exploreOptionsMatch[1]) {
      try {
        exploreOptions = JSON.parse(decodeURIComponent(exploreOptionsMatch[1]));
      } catch (e) {
        console.warn('[extractActionItems] Failed to parse exploreOptions:', e);
      }
    }

    const item = parseActionItemContent(
      content, priority, category, itemIndex, slot, actionType,
      confidenceTier, canSimulate, simulationNote, categories,
      skillGroupIndex, skillGroupLabel, skillGroupSlot, skillGroupIsMain, skillGroupTag,
      suggestedActions, exploreOptions
    );
    if (item) {
      items.push(item);
      itemIndex++;
    }
  }

  // Sort by priority (ascending - priority 1 is highest)
  items.sort((a, b) => a.priority - b.priority);

  return items;
}

/**
 * Parse the content of a single action-item div to extract title, impact, and evidence.
 *
 * @param content - Inner HTML content of the action-item div
 * @param priority - Priority value from data attribute
 * @param category - Category from data attribute
 * @param index - Index for generating unique ID
 * @param slot - Optional equipment slot from data-slot attribute
 * @param actionType - Action type from data-action-type attribute
 * @param confidenceTier - Optional confidence tier (verified, meta-backed, utility)
 * @param canSimulate - Optional flag indicating if this can be simulated
 * @param simulationNote - Optional note about simulation limitations
 * @param suggestedActions - Optional LLM-determined action buttons (Spec 039)
 * @param exploreOptions - Optional pre-generated explore options (Spec 039)
 * @returns ActionItem or null if required fields missing
 */
function parseActionItemContent(
  content: string,
  priority: number,
  category: ActionCategory,
  index: number,
  slot?: string,
  actionType: ActionType = 'both',
  confidenceTier?: 'verified' | 'meta-backed' | 'utility',
  canSimulate?: boolean,
  simulationNote?: string,
  categories?: ActionCategory[],
  skillGroupIndex?: number,
  skillGroupLabel?: string,
  skillGroupSlot?: string,
  skillGroupIsMain?: boolean,
  skillGroupTag?: string,
  suggestedActions?: ActionButtonType[],
  exploreOptions?: ExploreOption[]
): ActionItem | null {
  // Extract title
  const titleMatch = content.match(/<span\s+class="action-title"[^>]*>([^<]+)<\/span>/);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Extract impact
  const impactMatch = content.match(/<span\s+class="action-impact"[^>]*>([^<]+)<\/span>/);
  const impact = impactMatch ? impactMatch[1].trim() : '';

  // Extract evidence (new field)
  const evidenceMatch = content.match(/<span\s+class="action-evidence"[^>]*>([^<]+)<\/span>/);
  const evidence = evidenceMatch ? evidenceMatch[1].trim() : '';

  // Extract reasoning (can contain HTML like <em> tags)
  const reasoningMatch = content.match(/<span\s+class="action-reasoning"[^>]*>([\s\S]*?)<\/span>/);
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : '';

  if (!title) {
    console.warn('[parseActionItemContent] Missing title, skipping action item');
    return null;
  }

  return {
    id: `action-${index}-${priority}-${category}`,
    priority,
    category,
    categories,
    title,
    impact,
    // Include new fields
    slot: slot || undefined, // Convert empty string to undefined
    actionType,
    evidence,
    reasoning: reasoning || undefined,
    // Confidence tier fields
    confidenceTier,
    canSimulate,
    simulationNote,
    skillGroupIndex,
    skillGroupLabel,
    skillGroupSlot,
    skillGroupIsMain,
    skillGroupTag,
    // Dynamic action fields (Spec 039)
    suggestedActions: suggestedActions?.length ? suggestedActions : undefined,
    exploreOptions: exploreOptions?.length ? exploreOptions : undefined,
  };
}

/**
 * Extract content from a pathway section (strengths or weaknesses).
 * Supports current format with pathway-strengths/pathway-weaknesses classes
 * and STRENGTHS/WEAKNESSES labels.
 *
 * Expected format:
 * <div class="pathway-strengths">
 *   <strong>STRENGTHS</strong>
 *   <div class="category-offensive">...</div>
 *   <div class="category-defensive">...</div>
 *   <div class="category-utility">...</div>
 * </div>
 *
 * @param bodyContent - The pathway-body div content
 * @param sectionType - 'good' for strengths, 'improve' for weaknesses
 * @returns The extracted content (including nested divs/ul/li structure if present) or empty string
 */
function extractPathwaySection(bodyContent: string, sectionType: 'good' | 'improve'): string {
  // Define class name and label for each section type
  const className = sectionType === 'good' ? 'pathway-strengths' : 'pathway-weaknesses';
  const labelPattern = sectionType === 'good' ? 'STRENGTHS' : 'WEAKNESSES';

  // Find the opening div tag with this class
  const openingTagRegex = new RegExp(`<div class="${className}">`, 'i');
  const openingMatch = bodyContent.match(openingTagRegex);

  if (openingMatch && openingMatch.index !== undefined) {
    // Found the section - now extract content using balanced div matching
    const startIndex = openingMatch.index + openingMatch[0].length;
    const content = extractBalancedDivContent(bodyContent.substring(startIndex));

    if (content) {
      // Remove the <strong>LABEL</strong> prefix from the content
      const escapedLabel = labelPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const labelRegex = new RegExp(`^\\s*<strong>${escapedLabel}<\\/strong>\\s*`, 'i');
      const cleanedContent = content.replace(labelRegex, '').trim();
      if (cleanedContent !== content.trim()) {
        return cleanedContent;
      }
      // If no label was found, return the content as-is (trimmed)
      return content.trim();
    }
  }

  return '';
}

/**
 * Extract content from inside a div, handling nested divs correctly.
 * Counts opening and closing div tags to find the matching closing tag.
 *
 * @param content - Content starting after the opening <div> tag
 * @returns The content up to (but not including) the matching closing </div>
 */
function extractBalancedDivContent(content: string): string {
  let depth = 1;
  let pos = 0;

  while (pos < content.length && depth > 0) {
    const nextOpen = content.indexOf('<div', pos);
    const nextClose = content.indexOf('</div>', pos);

    if (nextClose === -1) {
      // No more closing tags - malformed HTML
      return '';
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      // Found an opening tag before the next closing tag
      depth++;
      pos = nextOpen + 4; // Move past '<div'
    } else {
      // Found a closing tag
      depth--;
      if (depth === 0) {
        // This is our matching closing tag
        return content.substring(0, nextClose);
      }
      pos = nextClose + 6; // Move past '</div>'
    }
  }

  return '';
}

/**
 * Get default SVG icon for a pathway type.
 * These match the icons defined in initial-analysis.ts.
 */
function getDefaultIcon(type: PathwayType): string {
  const icons: Record<PathwayType, string> = {
    skills: `<svg class="pathway-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    tree: `<svg class="pathway-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>`,
    gear: `<svg class="pathway-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>`,
  };
  return icons[type];
}

/**
 * Check if the HTML contains valid pathway cards.
 * Returns true if at least one valid card can be parsed.
 */
export function hasValidPathwayCards(html: string): boolean {
  const cards = parsePathwayCards(html);
  return cards.length > 0;
}

/**
 * Parse general assessment from the initial analysis HTML response.
 * Supports both legacy and expanded format.
 *
 * Legacy format:
 * ```html
 * <div class="general-assessment">
 *   <div class="assessment-strengths">...</div>
 *   <div class="assessment-weaknesses">...</div>
 * </div>
 * ```
 *
 * Expanded format:
 * ```html
 * <div class="expanded-assessment">
 *   <p class="build-overview">...</p>
 *   <div class="category-section" data-category="offensive">
 *     <div class="category-strengths">...</div>
 *     <div class="category-weaknesses">...</div>
 *   </div>
 *   <div class="category-section" data-category="defensive">...</div>
 *   <div class="category-section" data-category="utility">...</div>
 * </div>
 * ```
 *
 * @param html - The full HTML response from initial analysis
 * @returns Parsed general assessment or null if not found
 */
export function parseGeneralAssessment(html: string): ParsedGeneralAssessment | null {
  // First try to parse expanded format
  const expanded = parseExpandedAssessment(html);
  if (expanded) return expanded;

  // Fall back to legacy format
  const assessmentStartIndex = html.indexOf('<div class="general-assessment">');
  if (assessmentStartIndex === -1) return null;

  const contentStart = assessmentStartIndex + '<div class="general-assessment">'.length;
  const assessmentContent = extractBalancedDivContent(html.substring(contentStart));
  if (!assessmentContent) return null;

  // Extract strengths from assessment-strengths div
  const strengthsMatch = assessmentContent.match(/<div class="assessment-strengths">/);
  let strengths = '';
  if (strengthsMatch && strengthsMatch.index !== undefined) {
    const strengthsStart = strengthsMatch.index + strengthsMatch[0].length;
    strengths = extractBalancedDivContent(assessmentContent.substring(strengthsStart)).trim();
  }

  // Extract weaknesses from assessment-weaknesses div
  const weaknessesMatch = assessmentContent.match(/<div class="assessment-weaknesses">/);
  let weaknesses = '';
  if (weaknessesMatch && weaknessesMatch.index !== undefined) {
    const weaknessesStart = weaknessesMatch.index + weaknessesMatch[0].length;
    weaknesses = extractBalancedDivContent(assessmentContent.substring(weaknessesStart)).trim();
  }

  if (!strengths && !weaknesses) return null;

  return {
    title: 'Build Assessment',
    strengths,
    weaknesses,
  };
}

/**
 * Parse expanded assessment format from the initial analysis HTML.
 *
 * Supports two formats:
 *
 * V3 format (current):
 * ```html
 * <div class="expanded-assessment expanded-assessment-v3">
 *   <div class="build-summary"><p>Summary text...</p></div>
 *   <div class="ratings-section">
 *     <div class="overall-rating">
 *       <div class="rating-item"><span class="rating-label">Overall</span><span class="rating-score" data-score="7">7/10 - Label</span></div>
 *     </div>
 *     <div class="pathway-ratings">
 *       <div class="rating-item"><span class="rating-label">Skills</span><span class="rating-score" data-score="8">8/10</span></div>
 *       ...
 *     </div>
 *   </div>
 * </div>
 * ```
 *
 * V2 format (legacy):
 * ```html
 * <div class="expanded-assessment">
 *   <div class="build-overview"><p>Overview paragraph text...</p></div>
 *   <div class="category-section category-offensive">...</div>
 *   ...
 * </div>
 * ```
 *
 * @param html - The full HTML response from initial analysis
 * @returns Parsed general assessment with expanded fields, or null if not found
 */
export function parseExpandedAssessment(html: string): ParsedGeneralAssessment | null {
  // Find the expanded-assessment div (supports both v3 and original format)
  const v3Tag = '<div class="expanded-assessment expanded-assessment-v3">';
  const originalTag = '<div class="expanded-assessment">';

  let expandedStartIndex = html.indexOf(v3Tag);
  let tagLength = v3Tag.length;
  const isV3 = expandedStartIndex !== -1;

  if (expandedStartIndex === -1) {
    expandedStartIndex = html.indexOf(originalTag);
    tagLength = originalTag.length;
  }

  if (expandedStartIndex === -1) return null;

  // Extract the expanded-assessment div content
  const contentStart = expandedStartIndex + tagLength;
  const assessmentContent = extractBalancedDivContent(html.substring(contentStart));

  if (!assessmentContent) return null;

  // Handle V3 format (current backend output)
  if (isV3) {
    return parseV3Assessment(assessmentContent);
  }

  // Handle V2/legacy format
  return parseV2Assessment(assessmentContent);
}

/**
 * Parse V3 assessment format with build-summary and ratings-section.
 */
function parseV3Assessment(assessmentContent: string): ParsedGeneralAssessment | null {
  // Extract build-summary
  let buildOverview = '';
  const summaryMatch = assessmentContent.match(/<div\s+class="build-summary"[^>]*>([\s\S]*?)<\/div>/);
  if (summaryMatch) {
    const innerContent = summaryMatch[1].trim();
    const pMatch = innerContent.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    buildOverview = pMatch ? pMatch[1].trim() : innerContent;
  }

  if (!buildOverview) return null;

  return {
    title: 'Build Assessment',
    // V3 doesn't have strengths/weaknesses, set empty for legacy compatibility
    strengths: '',
    weaknesses: '',
    // Set the build overview
    buildOverview,
    // V3 doesn't use categories - ratings come from separate buildRatings prop
    categories: undefined,
  };
}

/**
 * Parse V2/legacy assessment format with build-overview and category-sections.
 */
function parseV2Assessment(assessmentContent: string): ParsedGeneralAssessment | null {
  // Extract build-overview - supports both formats:
  // 1. <div class="build-overview"><p>...</p></div>  (backend synthesis format)
  // 2. <p class="build-overview">...</p>  (original expected format)
  let buildOverview = '';

  // Try div wrapper format first (backend synthesis)
  const divOverviewMatch = assessmentContent.match(/<div\s+class="build-overview"[^>]*>([\s\S]*?)<\/div>/);
  if (divOverviewMatch) {
    // Extract inner content, strip the <p> tags if present
    const innerContent = divOverviewMatch[1].trim();
    const pMatch = innerContent.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    buildOverview = pMatch ? pMatch[1].trim() : innerContent;
  } else {
    // Try direct <p> format
    const overviewMatch = assessmentContent.match(/<p\s+class="build-overview"[^>]*>([\s\S]*?)<\/p>/);
    buildOverview = overviewMatch ? overviewMatch[1].trim() : '';
  }
  // Extract category sections
  const categories = extractCategoryAssessments(assessmentContent);

  // Validate we have at least some content
  if (!buildOverview && !categories) return null;

  // Build combined legacy-style strengths/weaknesses for backwards compatibility
  const allStrengths: string[] = [];
  const allWeaknesses: string[] = [];

  if (categories) {
    for (const cat of ['offensive', 'defensive', 'utility'] as const) {
      if (categories[cat].strengths) {
        allStrengths.push(categories[cat].strengths);
      }
      if (categories[cat].weaknesses) {
        allWeaknesses.push(categories[cat].weaknesses);
      }
    }
  }

  return {
    title: 'Build Assessment',
    // Combine for legacy compatibility
    strengths: allStrengths.join(' '),
    weaknesses: allWeaknesses.join(' '),
    // New expanded fields
    buildOverview: buildOverview || undefined,
    categories: categories || undefined,
  };
}

/**
 * Extract category-specific assessments from expanded assessment content.
 *
 * @param content - The inner content of the expanded-assessment div
 * @returns Category assessments object or null if none found
 */
function extractCategoryAssessments(
  content: string
): { offensive: CategoryAssessment; defensive: CategoryAssessment; utility: CategoryAssessment } | null {
  const categories: Record<string, CategoryAssessment> = {
    offensive: { strengths: '', weaknesses: '' },
    defensive: { strengths: '', weaknesses: '' },
    utility: { strengths: '', weaknesses: '' },
  };

  let foundAny = false;

  // Find each category-section div
  for (const category of ['offensive', 'defensive', 'utility']) {
    // Match the category-section div with the specific category class
    const sectionRegex = new RegExp(
      `<div\\s+class="category-section\\s+category-${category}"[^>]*>`,
      'i'
    );
    const sectionMatch = content.match(sectionRegex);

    if (sectionMatch && sectionMatch.index !== undefined) {
      const sectionStart = sectionMatch.index + sectionMatch[0].length;
      const sectionContent = extractBalancedDivContent(content.substring(sectionStart));

      if (sectionContent) {
        // Extract category-strengths
        const strengthsMatch = sectionContent.match(/<div\s+class="category-strengths"[^>]*>/);
        if (strengthsMatch && strengthsMatch.index !== undefined) {
          const strengthsStart = strengthsMatch.index + strengthsMatch[0].length;
          const strengths = extractBalancedDivContent(sectionContent.substring(strengthsStart)).trim();
          if (strengths) {
            categories[category].strengths = strengths;
            foundAny = true;
          }
        }

        // Extract category-weaknesses
        const weaknessesMatch = sectionContent.match(/<div\s+class="category-weaknesses"[^>]*>/);
        if (weaknessesMatch && weaknessesMatch.index !== undefined) {
          const weaknessesStart = weaknessesMatch.index + weaknessesMatch[0].length;
          const weaknesses = extractBalancedDivContent(sectionContent.substring(weaknessesStart)).trim();
          if (weaknesses) {
            categories[category].weaknesses = weaknesses;
            foundAny = true;
          }
        }
      }
    }
  }

  if (!foundAny) return null;

  return categories as { offensive: CategoryAssessment; defensive: CategoryAssessment; utility: CategoryAssessment };
}
