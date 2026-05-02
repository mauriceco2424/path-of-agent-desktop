/**
 * Chat Mode Types for ChatPage Redesign
 *
 * Defines the UI mode types for the middle panel mode selector.
 * These are distinct from backend pathway/general routing controls.
 */

/**
 * UI mode for the middle panel in ChatPage
 * - 'analyze-config': Analysis configuration (default landing state with welcome header)
 * - 'analyze-results': Viewing analysis results with pathway tabs
 */
export type ChatMode = 'analyze-config' | 'analyze-results';

/**
 * Context for chat mode when initiated from a pathway
 * - 'skills': Chat initiated from skills pathway (gem optimization)
 * - 'tree': Chat initiated from tree pathway (passive optimization)
 * - 'general': General chat or "Ask Questions" from analysis
 * - null: No pathway context
 */
export type PathwayContext = 'skills' | 'tree' | 'general' | null;

/**
 * Focus areas for targeted analysis mode
 * User can select which aspects of their build to analyze
 * - 'skills', 'gear', 'tree': Structured pathway analysis
 * - 'unified': Whole-build tool-backed unified analysis mode
 * - 'qa': Custom prompt / question-answer (added dynamically when customPrompt is used)
 */
export type AnalysisFocus = 'skills' | 'gear' | 'tree' | 'unified' | 'qa' | 'progression';

/**
 * Configuration for the Analyze mode
 * Controls what aspects to analyze
 */
export interface AnalysisConfig {
  /** Which build aspects to focus on (can select multiple) */
  focus: AnalysisFocus[];
  /** Optional custom prompt to guide the analysis */
  customPrompt: string;
}

/**
 * Mode metadata for UI display
 */
export interface ModeInfo {
  id: ChatMode;
  label: string;
  description: string;
}

/**
 * Mode definitions with display metadata
 */
export const MODE_INFO: Record<ChatMode, ModeInfo> = {
  'analyze-config': {
    id: 'analyze-config',
    label: 'Analyze',
    description: 'Configure and run build analysis',
  },
  'analyze-results': {
    id: 'analyze-results',
    label: 'Results',
    description: 'View analysis results by pathway',
  },
};
