import { DEFAULT_SCHEDULER } from './scheduler';
import type { AppData, Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  scheduler: { ...DEFAULT_SCHEDULER },
  ratingLabel: 'Difficulty',
  tempoStep: 4,
  theme: 'system',
};

export function emptyData(): AppData {
  return {
    schemaVersion: 1,
    tasks: [],
    sessions: [],
    settings: { ...DEFAULT_SETTINGS, scheduler: { ...DEFAULT_SCHEDULER } },
  };
}

/** Short descriptions shown under the rating picker so "8" means the same thing every day. */
export const RATING_ANCHORS: Record<number, string> = {
  10: 'Effortless — performance-ready at this tempo',
  9: 'Clean at tempo, one or two tiny slips',
  8: 'Solid — small hesitations, no stops',
  7: 'Got through it with a few errors',
  6: 'Got through it with several errors or hesitations',
  5: 'Struggled — had to stop and restart',
  4: 'Struggled — had to stop and restart often',
  3: "Can't play it through yet",
  2: "Can't play it yet",
  1: "Can't play it at all yet",
};
