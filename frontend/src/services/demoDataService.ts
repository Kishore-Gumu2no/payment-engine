/**
 * Demo Data Service
 * Loads and provides access to pre-generated demo data for public demo mode
 */

import { getDemoDataPath, isDemoMode } from '../types/demo.js';
import type {
  DemoDataBundle,
  DemoScenario,
  DemoExecution,
  FailurePattern,
} from '../types/demo.js';
import type { ScenarioStep, CompileResponse } from '../types/api.js';
import type { LogEntry, ExecutionMetrics } from '../types/scenario.js';

/** Cached demo data */
let demoDataCache: DemoDataBundle | null = null;
let cachePromise: Promise<DemoDataBundle> | null = null;

/**
 * Load demo data from public/data/demo.json
 */
export async function loadDemoData(): Promise<DemoDataBundle> {
  if (demoDataCache) {
    return demoDataCache;
  }

  if (cachePromise) {
    return cachePromise;
  }

  cachePromise = (async () => {
    try {
      const response = await fetch(getDemoDataPath());
      if (!response.ok) {
        throw new Error(`Failed to load demo data: ${response.status}`);
      }
      const data = (await response.json()) as DemoDataBundle;
      demoDataCache = data;
      return data;
    } catch (error) {
      cachePromise = null;
      throw error;
    }
  })();

  return cachePromise;
}

/**
 * Get all demo scenarios
 */
export async function getDemoScenarios(): Promise<DemoScenario[]> {
  if (!isDemoMode()) {
    return [];
  }
  const data = await loadDemoData();
  return data.scenarios;
}

/**
 * Get demo scenario by ID
 */
export async function getDemoScenario(id: string): Promise<DemoScenario | null> {
  if (!isDemoMode()) {
    return null;
  }
  const scenarios = await getDemoScenarios();
  return scenarios.find((s) => s.id === id) || null;
}

/**
 * Get all demo executions
 */
export async function getDemoExecutions(): Promise<DemoExecution[]> {
  if (!isDemoMode()) {
    return [];
  }
  const data = await loadDemoData();
  return data.executions;
}

/**
 * Get demo executions for a scenario
 */
export async function getDemoExecutionsForScenario(scenarioId: string): Promise<DemoExecution[]> {
  if (!isDemoMode()) {
    return [];
  }
  const executions = await getDemoExecutions();
  return executions.filter((e) => e.scenarioId === scenarioId);
}

/**
 * Get demo execution by ID
 */
export async function getDemoExecution(id: string): Promise<DemoExecution | null> {
  if (!isDemoMode()) {
    return null;
  }
  const executions = await getDemoExecutions();
  return executions.find((e) => e.id === id) || null;
}

/**
 * Get compiled rulebooks (for AI compiler demo)
 */
export async function getDemoRulebooks(): Promise<CompileResponse[]> {
  if (!isDemoMode()) {
    return [];
  }
  const data = await loadDemoData();
  return data.rulebooks;
}

/**
 * Get failure patterns
 */
export async function getFailurePatterns(): Promise<FailurePattern[]> {
  if (!isDemoMode()) {
    return [];
  }
  const data = await loadDemoData();
  return data.failurePatterns;
}

/**
 * Simulate a compile in demo mode (returns pre-generated rulebook)
 */
export async function simulateCompile(prompt: string): Promise<CompileResponse> {
  if (!isDemoMode()) {
    throw new Error('Demo compile only available in demo mode');
  }

  const rulebooks = await getDemoRulebooks();
  if (rulebooks.length === 0) {
    throw new Error('No demo rulebooks available');
  }

  // Simple matching: return first rulebook, or one that matches keywords
  const matched = rulebooks.find((rb) =>
    rb.rulebook.some((step: ScenarioStep) =>
      prompt.toLowerCase().includes(step.action.toLowerCase())
    )
  );

  return matched || rulebooks[0];
}

/**
 * Simulate an execution in demo mode (returns pre-generated execution)
 */
export async function simulateExecution(scenarioId: string): Promise<DemoExecution> {
  if (!isDemoMode()) {
    throw new Error('Demo execution only available in demo mode');
  }

  const executions = await getDemoExecutionsForScenario(scenarioId);
  if (executions.length === 0) {
    throw new Error(`No demo executions for scenario ${scenarioId}`);
  }

  // Return a random execution for variety
  return executions[Math.floor(Math.random() * executions.length)];
}

/**
 * Clear demo data cache (useful for development)
 */
export function clearDemoCache(): void {
  demoDataCache = null;
  cachePromise = null;
}

/**
 * Create demo data structure for generating demo.json
 * This is a helper for creating the demo data file
 */
export function createDemoDataBundle(
  scenarios: DemoScenario[],
  executions: DemoExecution[],
  rulebooks: CompileResponse[],
  failurePatterns: FailurePattern[]
): DemoDataBundle {
  return {
    scenarios,
    executions,
    rulebooks,
    failurePatterns,
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Helper to create a demo scenario
 */
export function createDemoScenario(
  id: string,
  name: string,
  description: string,
  steps: ScenarioStep[]
): DemoScenario {
  return {
    id,
    name,
    description,
    steps,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Helper to create a demo execution
 */
export function createDemoExecution(
  id: string,
  scenarioId: string,
  logs: LogEntry[],
  metrics: ExecutionMetrics
): DemoExecution {
  return {
    id,
    scenarioId,
    timestamp: new Date().toISOString(),
    logs,
    metrics,
  };
}