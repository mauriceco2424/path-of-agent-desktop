/**
 * Settings Store
 *
 * Persists user display preferences to localStorage (survives across sessions).
 * Separate from the main store which uses sessionStorage.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type FontScale = 'compact' | 'normal' | 'large';

/** Brightness level 0-4: 0 = darkest, 2 = default (middle), 4 = brightest */
export type BrightnessLevel = 0 | 1 | 2 | 3 | 4;

export interface SettingsState {
  fontScale: FontScale;
  brightness: BrightnessLevel;
  /** Whether the user consented to session data collection. undefined = not yet asked. */
  sessionDataConsent?: boolean;
  /** POESESSID cookie from pathofexile.com — enables authenticated Trade API requests for better rate limits */
  poesessid: string;
}

export interface SettingsActions {
  setFontScale: (scale: FontScale) => void;
  setBrightness: (level: BrightnessLevel) => void;
  setSessionDataConsent: (consent: boolean | undefined) => void;
  setPoesessid: (value: string) => void;
}

export type SettingsStore = SettingsState & SettingsActions;

const initialState: SettingsState = {
  fontScale: 'normal',
  brightness: 2,
  sessionDataConsent: undefined,
  poesessid: '',
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...initialState,

      setFontScale: (scale: FontScale) => {
        set({ fontScale: scale });
      },

      setBrightness: (level: BrightnessLevel) => {
        set({ brightness: level });
      },

      setSessionDataConsent: (consent: boolean | undefined) => {
        set({ sessionDataConsent: consent });
      },

      setPoesessid: (value: string) => {
        set({ poesessid: value });
      },
    }),
    {
      name: 'poa-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
