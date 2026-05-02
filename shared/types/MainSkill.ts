import type { GemInstance } from './GemInstance';

export interface MainSkill {
  name: string;
  gem: GemInstance;
  supports: GemInstance[];
  supportGems?: GemInstance[];
  skillId?: string;
  skillPartName?: string;
  isInferred?: boolean;
  dps?: number;
  description?: string;
  [key: string]: unknown;
}
