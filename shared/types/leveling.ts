/**
 * Leveling Assistant Types
 *
 * Types for the standalone leveling guide feature that helps users
 * progress through Acts 1-10 with checkable tasks and chat assistance.
 *
 * @module shared/types/leveling
 */

// =============================================================================
// Task Types
// =============================================================================

/** Types of tasks in the leveling guide */
export type LevelingTaskType =
  | 'quest' // Main story quests
  | 'trial' // Labyrinth trials
  | 'passive' // Skill point rewards
  | 'boss' // Act bosses
  | 'milestone' // Gear/resistance checkpoints
  | 'vendor'; // Vendor interactions (gems, etc.)

/** Priority levels for tasks */
export type TaskPriority = 'critical' | 'required' | 'recommended' | 'optional';

/**
 * A single checkable task in the leveling guide
 */
export interface LevelingTask {
  /** Unique identifier, e.g., "act-1-step-5" */
  id: string;

  /** Which act this task belongs to (1-10) */
  actNumber: number;

  /** Type of task */
  type: LevelingTaskType;

  /** Short title, e.g., "Kill Hailrake on Tidal Island" */
  title: string;

  /** Optional longer description */
  description?: string;

  /** How important is this task */
  priority: TaskPriority;

  /** Zone where task is completed, e.g., "Tidal Island" */
  zone?: string;

  /** What reward you get, e.g., "Quicksilver Flask" */
  reward?: string;

  /** Sequential step number within the act (1-based) */
  stepNumber?: number;

  /** Detailed instructions shown when this is the active step */
  details?: string;

  /** NPC to talk to (shown highlighted in green) */
  npc?: string;

  /** Boss to defeat (shown highlighted in red) */
  boss?: string;

  /** Navigation tip for efficiency */
  navigationTip?: string;
}

// =============================================================================
// Act Task Groups
// =============================================================================

/**
 * Boss information for an act
 */
export interface BossInfo {
  /** Boss name, e.g., "Merveil" */
  name: string;

  /** Zone where boss is located */
  zone: string;

  /** Combat tips for the boss */
  tips: string[];
}

/**
 * All tasks for a single act
 */
export interface ActTaskGroup {
  /** Act number (1-10) */
  actNumber: number;

  /** Level range for this act, e.g., "1-13" */
  levelRange: string;

  /** Town name for this act */
  town?: string;

  /** All tasks in this act */
  tasks: LevelingTask[];

  /** Boss information if there's an act boss */
  bossInfo?: BossInfo;
}

/**
 * Complete leveling guide data (all acts)
 */
export interface LevelingGuideData {
  /** All act task groups */
  acts: ActTaskGroup[];

  /** General tips that apply across all acts */
  generalTips?: string[];
}

// =============================================================================
// Progress Tracking
// =============================================================================

/**
 * User's progress through the leveling guide
 */
export interface LevelingProgress {
  /** Currently selected act (1-10) */
  currentAct: number;

  /** IDs of completed tasks */
  completedTaskIds: string[];

  /** Timestamp of last update */
  lastUpdated: number;
}

// =============================================================================
// Chat Types
// =============================================================================

/** Role in a chat message */
export type LevelingChatRole = 'user' | 'assistant';

/**
 * A message in the leveling chat
 */
export interface LevelingChatMessage {
  /** Unique message ID */
  id: string;

  /** Who sent this message */
  role: LevelingChatRole;

  /** Message content (text) */
  content: string;

  /** Optional image URL for screenshots */
  imageUrl?: string;

  /** When message was sent */
  timestamp: number;
}

/**
 * Request body for leveling chat endpoint
 */
export interface LevelingChatRequest {
  /** User's message */
  message: string;

  /** Optional base64-encoded screenshot */
  imageBase64?: string;

  /** Which act the user is currently on (for context) */
  currentAct?: number;

  /** Previous messages for context (optional) */
  history?: LevelingChatMessage[];
}

/**
 * Response from leveling chat endpoint (streamed via SSE)
 */
export interface LevelingChatResponse {
  /** Message ID */
  id: string;

  /** Response content */
  content: string;

  /** Whether this is the final chunk */
  done: boolean;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Response from GET /api/v1/leveling/tasks
 */
export interface LevelingTasksResponse {
  /** All act task groups */
  acts: ActTaskGroup[];

  /** General leveling tips */
  generalTips: string[];
}
