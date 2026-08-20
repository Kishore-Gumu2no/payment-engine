import { useState, useCallback, useMemo } from 'react';
import { getScenarioService } from '../services/scenarioService.js';
import type { CompiledStep, BuiltStep, CompileResult, ExecutionResult, DemoScenario, DemoExecution } from '../types/index.js';

export function useScenario() {
  const service = getScenarioService();
  const [isCompiling, setIsCompiling] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const compile = useCallback(async (prompt: string) => {
    setIsCompiling(true);
    setCompileError(null);
    setCompileResult(null);

    try {
      const result = await service.compile(prompt);
      setCompileResult(result);
      if (!result.success) {
        setCompileError(result.error || 'Compilation failed');
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setCompileError(message);
      return { success: false, error: message } as CompileResult;
    } finally {
      setIsCompiling(false);
    }
  }, [service]);

  const execute = useCallback(async (steps: CompiledStep[]) => {
    setIsExecuting(true);
    setExecutionError(null);
    setExecutionResult(null);

    try {
      const result = await service.execute(steps);
      setExecutionResult(result);
      if (!result.success) {
        setExecutionError(result.error || 'Execution failed');
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setExecutionError(message);
      return { success: false, error: message, logs: [], metrics: { total: 0, ok200: 0, conflict409: 0, error500: 0, refundsProcessed: 0, totalAmount: 0, totalRefundAmount: 0 } } as ExecutionResult;
    } finally {
      setIsExecuting(false);
    }
  }, [service]);

  const executeManual = useCallback(async (steps: BuiltStep[]) => {
    setIsExecuting(true);
    setExecutionError(null);
    setExecutionResult(null);

    try {
      const result = await service.executeManual(steps);
      setExecutionResult(result);
      if (!result.success) {
        setExecutionError(result.error || 'Execution failed');
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setExecutionError(message);
      return { success: false, error: message, logs: [], metrics: { total: 0, ok200: 0, conflict409: 0, error500: 0, refundsProcessed: 0, totalAmount: 0, totalRefundAmount: 0 } } as ExecutionResult;
    } finally {
      setIsExecuting(false);
    }
  }, [service]);

  const getDemoScenarios = useCallback(async () => {
    return service.getDemoScenarios();
  }, [service]);

  const getDemoScenario = useCallback(async (id: string) => {
    return service.getDemoScenario(id);
  }, [service]);

  const getDemoExecutions = useCallback(async () => {
    return service.getDemoExecutions();
  }, [service]);

  const getDemoExecutionsForScenario = useCallback(async (scenarioId: string) => {
    return service.getDemoExecutionsForScenario(scenarioId);
  }, [service]);

  const clearCompileResult = useCallback(() => {
    setCompileResult(null);
    setCompileError(null);
  }, []);

  const clearExecutionResult = useCallback(() => {
    setExecutionResult(null);
    setExecutionError(null);
  }, []);

  return useMemo(() => ({
    compile,
    execute,
    executeManual,
    getDemoScenarios,
    getDemoScenario,
    getDemoExecutions,
    getDemoExecutionsForScenario,
    clearCompileResult,
    clearExecutionResult,
    state: {
      isCompiling,
      isExecuting,
      compileResult,
      executionResult,
      compileError,
      executionError,
    },
  }), [
    compile,
    execute,
    executeManual,
    getDemoScenarios,
    getDemoScenario,
    getDemoExecutions,
    getDemoExecutionsForScenario,
    clearCompileResult,
    clearExecutionResult,
    isCompiling,
    isExecuting,
    compileResult,
    executionResult,
    compileError,
    executionError,
  ]);
}