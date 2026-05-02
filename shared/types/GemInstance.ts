export interface GemInstance {
  name: string;
  level?: number;
  quality?: number;
  isSupport?: boolean;
  skillId?: string;
  qualityType?: string;
  isAwakened?: boolean;
  isVaal?: boolean;
  enabled?: boolean;
  [key: string]: unknown;
}

/** Supported gem quality descriptors */
export type GemQualityType = 'superior' | 'anomalous' | 'divergent' | 'phantasmal' | string;
