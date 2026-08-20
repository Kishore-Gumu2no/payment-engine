/**
 * Demo Data Types
 * Static demo data structures for public demo mode
 */

import type { ScenarioStep } from './api.js';
import type { CompileResponse } from './api.js';
import type { LogEntry, ExecutionMetrics } from './scenario.js';

/** Demo scenario record */
export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  steps: ScenarioStep[];
  createdAt: string;
}

/** Demo execution record */
export interface DemoExecution {
  id: string;
  scenarioId: string;
  timestamp: string;
  logs: LogEntry[];
  metrics: ExecutionMetrics;
}

/** Demo data bundle loaded from public/data/demo.json */
export interface DemoDataBundle {
  scenarios: DemoScenario[];
  executions: DemoExecution[];
  rulebooks: CompileResponse[];
  failurePatterns: FailurePattern[];
  version: string;
  generatedAt: string;
}

/** Failure injection patterns for demo */
export interface FailurePattern {
  id: string;
  name: string;
  description: string;
  scenario: ScenarioStep[];
  expectedMetrics: Partial<ExecutionMetrics>;
}

/** Demo mode configuration */
export interface DemoConfig {
  enabled: boolean;
  dataPath: string;
  showBadges: boolean;
}

/** Default demo configuration */
export const DEFAULT_DEMO_CONFIG: DemoConfig = {
  enabled: import.meta.env.VITE_DEMO_MODE === 'true',
  dataPath: '/data/demo.json',
  showBadges: true,
};

/** Check if we're in demo mode */
export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true';
}

/** Get demo data path */
export function getDemoDataPath(): string {
  return import.meta.env.VITE_DEMO_DATA_PATH || '/data/demo.json';
}