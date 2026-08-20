/**
 * Scenario Service
 * High-level service for scenario compilation, execution, and management
 * Handles both demo and live modes transparently
 */

import { MODE } from '../config/mode.js';
import { apiClient, executeBatch, generateIdempotencyKey, type BatchRequestConfig } from './apiClient.js';
import {
  loadDemoData,
  getDemoScenarios,
  getDemoScenario,
  getDemoExecutions,
  getDemoExecutionsForScenario,
  simulateCompile,
  simulateExecution,
  clearDemoCache,
} from './demoDataService.js';
import type {
  ScenarioStep,
  CompileResponse,
  CompileRequest,
  PaymentRequest,
  RefundRequest,
} from '../types/api.js';
import type {
  BuiltStep,
  StepFormState,
  LogEntry,
  ExecutionMetrics,
  CompiledStep,
  ExecutionRecord,
  DemoScenario,
  DemoExecution,
} from '../types/scenario.js';

/** Result of a scenario compilation */
export interface CompileResult {
  success: boolean;
  steps?: CompiledStep[];
  rulebook?: ScenarioStep[];
  error?: string;
}

/** Result of a scenario execution */
export interface ExecutionResult {
  success: boolean;
  logs: LogEntry[];
  metrics: ExecutionMetrics;
  error?: string;
}

/** Scenario service interface */
export interface ScenarioService {
  /** Compile a natural language prompt to steps */
  compile(prompt: string): Promise<CompileResult>;

  /** Execute a compiled scenario */
  execute(steps: CompiledStep[]): Promise<ExecutionResult>;

  /** Execute manual built steps */
  executeManual(steps: BuiltStep[]): Promise<ExecutionResult>;

  /** Get demo scenarios (demo mode only) */
  getDemoScenarios(): Promise<DemoScenario[]>;

  /** Get demo scenario by ID (demo mode only) */
  getDemoScenario(id: string): Promise<DemoScenario | null>;

  /** Get demo executions (demo mode only) */
  getDemoExecutions(): Promise<DemoExecution[]>;

  /** Get demo executions for scenario (demo mode only) */
  getDemoExecutionsForScenario(scenarioId: string): Promise<DemoExecution[]>;

  /** Simulate compile in demo mode */
  simulateCompile(prompt: string): Promise<CompileResponse>;

  /** Simulate execution in demo mode */
  simulateExecution(scenarioId: string): Promise<DemoExecution>;

  /** Clear demo cache */
  clearCache(): void;
}

/**
 * Convert manual built steps to compiled steps format
 */
function builtStepsToCompiled(steps: BuiltStep[]): CompiledStep[] {
  return steps.map((step) => ({
    action: step.actionType,
    amount: step.actionType === 'PAYMENT' ? 100 : 0, // Default amount
    requestVolume: step.requestVolume,
    executionStrategy: step.executionStrategy,
  }));
}

/**
 * Convert compiled steps to API scenario steps for sync
 */
function compiledStepsToApiSteps(steps: CompiledStep[]): ScenarioStep[] {
  return steps.map((step, index) => {
    const base = {
      stepId: String(index + 1),
      action: step.action,
      requestVolume: step.requestVolume,
      executionStrategy: step.executionStrategy as 'Sequential' | 'Concurrent Attack',
      mockResponse: {
        httpStatus: 200,
        body: { message: 'Success' },
      },
    };

    if (step.action === 'PAYMENT') {
      return {
        ...base,
        action: 'PAYMENT' as const,
        amount: step.amount,
      };
    } else {
      return {
        ...base,
        action: 'REFUND' as const,
        originalTransactionId: 'txn_123',
      };
    }
  });
}

/**
 * Create the scenario service
 */
export function createScenarioService(): ScenarioService {
  return {
    async compile(prompt: string): Promise<CompileResult> {
      if (MODE.isDemo) {
        try {
          const response = await simulateCompile(prompt);
          const compiledSteps = response.rulebook.map((step: ScenarioStep) => ({
            action: step.action,
            amount: 'amount' in step ? step.amount : 0,
            requestVolume: step.requestVolume,
            executionStrategy: step.executionStrategy,
          }));
          return { success: true, steps: compiledSteps, rulebook: response.rulebook };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Demo compile failed',
          };
        }
      }

      try {
        const response = await apiClient.compileScenario(prompt);
        const compiledSteps = response.rulebook.map((step: ScenarioStep) => ({
          action: step.action,
          amount: 'amount' in step ? step.amount : 0,
          requestVolume: step.requestVolume,
          executionStrategy: step.executionStrategy,
        }));
        return { success: true, steps: compiledSteps, rulebook: response.rulebook };
      } catch (error) {
        const apiError = error as Error;
        return {
          success: false,
          error: apiError.message,
        };
      }
    },

    async execute(steps: CompiledStep[]): Promise<ExecutionResult> {
      if (MODE.isDemo) {
        // In demo mode, we need a scenario ID to simulate
        // For now, use the first available demo scenario
        try {
          const scenarios = await getDemoScenarios();
          if (scenarios.length === 0) {
            return { success: false, logs: [], metrics: emptyMetrics(), error: 'No demo scenarios available' };
          }
          const execution = await simulateExecution(scenarios[0].id);
          return {
            success: true,
            logs: execution.logs,
            metrics: execution.metrics,
          };
        } catch (error) {
          return {
            success: false,
            logs: [],
            metrics: emptyMetrics(),
            error: error instanceof Error ? error.message : 'Demo execution failed',
          };
        }
      }

      return executeLive(steps);
    },

    async executeManual(steps: BuiltStep[]): Promise<ExecutionResult> {
      const compiled = builtStepsToCompiled(steps);
      return this.execute(compiled);
    },

    async getDemoScenarios(): Promise<DemoScenario[]> {
      return getDemoScenarios();
    },

    async getDemoScenario(id: string): Promise<DemoScenario | null> {
      return getDemoScenario(id);
    },

    async getDemoExecutions(): Promise<DemoExecution[]> {
      return getDemoExecutions();
    },

    async getDemoExecutionsForScenario(scenarioId: string): Promise<DemoExecution[]> {
      return getDemoExecutionsForScenario(scenarioId);
    },

    async simulateCompile(prompt: string): Promise<CompileResponse> {
      return simulateCompile(prompt);
    },

    async simulateExecution(scenarioId: string): Promise<DemoExecution> {
      return simulateExecution(scenarioId);
    },

    clearCache(): void {
      clearDemoCache();
    },
  };
}

/**
 * Execute scenario against live backend
 */
async function executeLive(steps: CompiledStep[]): Promise<ExecutionResult> {
  const logs: LogEntry[] = [];
  const metrics = emptyMetrics();

  const appendLog = (entry: Omit<LogEntry, 'id'>) => {
    logs.push({ ...entry, id: crypto.randomUUID() });
    updateMetrics(entry);
  };

  const updateMetrics = (entry: Omit<LogEntry, 'id'>) => {
    metrics.total++;
    if (entry.status === 200) {
      metrics.ok200++;
      if (entry.action === 'REFUND') metrics.refundsProcessed++;
    } else if (entry.status === 409) {
      metrics.conflict409++;
    } else if (entry.status >= 500) {
      metrics.error500++;
    }
  };

  try {
    for (const step of steps) {
      const endpoint = step.action === 'PAYMENT' ? 'payment' : 'refund';
      const baseRequest: PaymentRequest | RefundRequest = step.action === 'PAYMENT'
        ? { amount: step.amount, idempotencyKey: '' }
        : { originalTransactionId: 'txn_123', idempotencyKey: '' };

      const strategy = step.executionStrategy.toLowerCase().includes('concurrent')
        ? 'shared'
        : 'unique';

      if (strategy === 'shared') {
        const sharedKey = generateIdempotencyKey();
        const batchConfig: BatchRequestConfig = {
          endpoint,
          count: step.requestVolume,
          baseRequest: { ...baseRequest, idempotencyKey: sharedKey },
          strategy: 'shared',
          onProgress: (result) => {
            appendLog({
              status: result.status,
              message: `[${step.action}] ${result.message}`,
              timestamp: new Date().toISOString().replace('T', ' ').slice(0, 23),
              action: step.action,
            });
          },
        };
        await executeBatch(batchConfig);
      } else {
        const batchConfig: BatchRequestConfig = {
          endpoint,
          count: step.requestVolume,
          baseRequest,
          strategy: 'unique',
          onProgress: (result) => {
            appendLog({
              status: result.status,
              message: `[${step.action}] ${result.message}`,
              timestamp: new Date().toISOString().replace('T', ' ').slice(0, 23),
              action: step.action,
            });
          },
        };
        await executeBatch(batchConfig);
      }
    }

    return { success: true, logs, metrics };
  } catch (error) {
    const apiError = error as Error;
    appendLog({
      status: 0,
      message: `Batch error: ${apiError.message}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 23),
    });
    return { success: false, logs, metrics, error: apiError.message };
  }
}

/** Create empty metrics object */
function emptyMetrics(): ExecutionMetrics {
  return {
    total: 0,
    ok200: 0,
    conflict409: 0,
    error500: 0,
    refundsProcessed: 0,
    totalAmount: 0,
    totalRefundAmount: 0,
  };
}

/** Singleton instance */
let scenarioServiceInstance: ScenarioService | null = null;

/** Get the scenario service singleton */
export function getScenarioService(): ScenarioService {
  if (!scenarioServiceInstance) {
    scenarioServiceInstance = createScenarioService();
  }
  return scenarioServiceInstance;
}