/**
 * Scenario & Execution Types
 * Frontend-specific types for the QA dashboard
 */

import type { ScenarioStep } from './api.js';
import type { DemoScenario, DemoExecution } from './demo.js';

/** Execution Strategy for UI */
export type ExecutionStrategy =
  | 'Sequential (Unique Keys)'
  | 'Concurrent Attack (Same Key)';

/** Action Type */
export type ActionType = 'PAYMENT' | 'REFUND';

/** Expected Outcome for manual builder */
export type ExpectedOutcome =
  | '200_SUCCESS'
  | '500_INTERNAL_ERROR'
  | 'TIMEOUT';

/** Form state for manual step builder */
export interface StepFormState {
  requestVolume: number;
  actionType: ActionType;
  expectedOutcome: ExpectedOutcome;
  executionStrategy: ExecutionStrategy;
}

/** A built step in the manual scenario builder */
export interface BuiltStep {
  id: string;
  requestVolume: number;
  actionType: ActionType;
  expectedOutcome: ExpectedOutcome;
  executionStrategy: ExecutionStrategy;
}

/** Terminal ref for imperative scroll control */
export interface TerminalRef {
  scrollToBottom: () => void;
  scrollToTop: () => void;
}

/** Log entry for execution terminal */
export interface LogEntry {
  id: string;
  status: number;
  message: string;
  timestamp: string;
  action?: ActionType;
}

/** Metrics aggregated from logs */
export interface ExecutionMetrics {
  total: number;
  ok200: number;
  conflict409: number;
  error500: number;
  refundsProcessed: number;
  totalAmount: number;
  totalRefundAmount: number;
}

/** Compiled step from AI (read-only preview) */
export interface CompiledStep {
  action: ActionType;
  amount: number;
  requestVolume: number;
  executionStrategy: string;
}

/** Execution state */
export type ExecutionStatus = 'idle' | 'compiling' | 'firing' | 'completed' | 'error';

/** Scenario execution record (for history) */
export interface ExecutionRecord {
  id: string;
  timestamp: string;
  scenario: ScenarioStep[];
  logs: LogEntry[];
  metrics: ExecutionMetrics;
  mode: 'demo' | 'live';
}

// Re-export demo types
export type { DemoScenario, DemoExecution };

/** Compile result from AI compiler */
export interface CompileResult {
  success: boolean;
  steps?: CompiledStep[];
  error?: string;
}

/** Execution result from scenario service */
export interface ExecutionResult {
  success: boolean;
  logs: LogEntry[];
  metrics: ExecutionMetrics;
  error?: string;
}

/** Default form state for manual builder */
export const DEFAULT_FORM: StepFormState = {
  requestVolume: 100,
  actionType: 'PAYMENT',
  expectedOutcome: '200_SUCCESS',
  executionStrategy: 'Sequential (Unique Keys)',
};