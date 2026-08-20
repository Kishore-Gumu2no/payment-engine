/**
 * Mode Configuration
 * Determines whether we run in demo mode or local/live mode
 */

import { isDemoMode as checkDemoMode, getDemoDataPath } from '../types/demo.js';

/** Current application mode */
export const MODE = {
  /** True if running in demo mode (no backend required) */
  isDemo: checkDemoMode(),

  /** True if connecting to real backend */
  isLocal: !checkDemoMode(),

  /** Demo data path */
  demoDataPath: getDemoDataPath(),

  /** API base URL for local mode */
  apiBase: import.meta.env.VITE_API_BASE || 'http://localhost:3000',
} as const;

/** Mode label for UI display */
export const MODE_LABEL = MODE.isDemo ? 'DEMO' : 'LIVE';

/** Mode badge color */
export const MODE_BADGE_COLOR = MODE.isDemo ? 'acid-lime' : 'pulse-green';