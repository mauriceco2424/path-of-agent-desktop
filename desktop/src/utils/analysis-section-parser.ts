/**
 * Analysis Section Parser
 *
 * Parses LLM streaming output that contains section markers (<!-- GEAR -->, <!-- SKILLS -->, <!-- TREE -->)
 * and extracts content for each pathway tab.
 */

export type PathwaySection = 'gear' | 'skills' | 'tree' | 'holistic' | 'qa' | 'unified' | 'progression';

export interface ParsedSections {
  gear: string;
  skills: string;
  tree: string;
  holistic: string;
  qa: string;
  unified: string;
  progression: string;
}

/**
 * Section markers used by the LLM to delimit content
 */
const SECTION_MARKERS: Record<PathwaySection, string> = {
  gear: '<!-- GEAR -->',
  skills: '<!-- SKILLS -->',
  tree: '<!-- TREE -->',
  holistic: '<!-- ASSESSMENT -->',
  qa: '<!-- Q&A -->',
  unified: '<!-- UNIFIED -->',
  progression: '<!-- PROGRESSION -->',
};

/**
 * Order of sections as output by LLM
 * Q&A comes first when present (user's specific question takes priority)
 */
const SECTION_ORDER: PathwaySection[] = ['qa', 'unified', 'holistic', 'gear', 'skills', 'tree'];

/**
 * Parse streaming content into separate sections by pathway.
 *
 * The LLM outputs content with markers like:
 * <!-- GEAR -->
 * [gear content...]
 * <!-- SKILLS -->
 * [skills content...]
 * <!-- TREE -->
 * [tree content...]
 *
 * This function extracts each section's content.
 *
 * @param content - The full or partial streaming content
 * @returns ParsedSections with content for each pathway (empty string if not present)
 */
export function parseAnalysisSections(content: string): ParsedSections {
  const result: ParsedSections = {
    gear: '',
    skills: '',
    tree: '',
    holistic: '',
    qa: '',
    unified: '',
    progression: '',
  };

  if (!content) return result;

  // Find positions of all section markers
  const positions: Array<{ section: PathwaySection; index: number }> = [];

  for (const section of SECTION_ORDER) {
    const marker = SECTION_MARKERS[section];
    const index = content.indexOf(marker);
    if (index !== -1) {
      positions.push({ section, index });
    }
  }

  // Sort by position in content
  positions.sort((a, b) => a.index - b.index);

  // Extract content between markers
  for (let i = 0; i < positions.length; i++) {
    const current = positions[i];
    const markerLength = SECTION_MARKERS[current.section].length;
    const startIndex = current.index + markerLength;

    // End is either the next marker or end of content
    const endIndex = i < positions.length - 1
      ? positions[i + 1].index
      : content.length;

    // Extract and trim the content (remove leading/trailing whitespace)
    let sectionContent = content.slice(startIndex, endIndex).trim();

    // Remove suggested_questions block if it appears at the end of the last section
    if (i === positions.length - 1) {
      const suggestedQuestionsIndex = sectionContent.indexOf('```suggested_questions');
      if (suggestedQuestionsIndex !== -1) {
        sectionContent = sectionContent.slice(0, suggestedQuestionsIndex).trim();
      }
    }

    result[current.section] = sectionContent;
  }

  // If no markers found, put all content into 'qa' section
  // This handles custom prompt responses that don't use section markers
  if (positions.length === 0) {
    // Remove suggested_questions block if present
    let qaContent = content.trim();
    const suggestedQuestionsIndex = qaContent.indexOf('```suggested_questions');
    if (suggestedQuestionsIndex !== -1) {
      qaContent = qaContent.slice(0, suggestedQuestionsIndex).trim();
    }
    result.qa = qaContent;
    return result;
  }

  return result;
}

/**
 * Get the content for a specific pathway tab from parsed sections.
 *
 * @param content - The full streaming content
 * @param activeTab - The currently active pathway tab
 * @returns The content for the active tab, or empty string if not available
 */
export function getActiveTabContent(content: string, activeTab: PathwaySection): string {
  const sections = parseAnalysisSections(content);
  return sections[activeTab];
}

/**
 * Check which sections are currently available in the streaming content.
 *
 * @param content - The streaming content
 * @returns Array of sections that have markers present
 */
export function getAvailableSections(content: string): PathwaySection[] {
  const available: PathwaySection[] = [];

  for (const section of SECTION_ORDER) {
    if (content.includes(SECTION_MARKERS[section])) {
      available.push(section);
    }
  }

  return available;
}

/**
 * Check if a section is currently being streamed (marker present but content may be incomplete).
 *
 * @param content - The streaming content
 * @param section - The section to check
 * @returns true if the section marker is present
 */
export function isSectionStreaming(content: string, section: PathwaySection): boolean {
  return content.includes(SECTION_MARKERS[section]);
}
