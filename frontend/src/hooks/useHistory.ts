import { useState, useEffect, useCallback, useMemo } from 'react';
import { getScenarioService } from '../services/scenarioService.js';
import type { DemoScenario, DemoExecution } from '../types/index.js';

export function useHistory() {
  const service = getScenarioService();
  const [executions, setExecutions] = useState<DemoExecution[]>([]);
  const [scenarios, setScenarios] = useState<DemoScenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'demo' | 'live'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExecution, setSelectedExecution] = useState<DemoExecution | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [execs, scens] = await Promise.all([
        service.getDemoExecutions(),
        service.getDemoScenarios(),
      ]);
      setExecutions(execs);
      setScenarios(scens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredExecutions = useMemo(() => {
    return executions.filter((exec) => {
      // In demo mode, we only have demo executions
      if (filter === 'live') return false;

      if (searchQuery) {
        const scenario = scenarios.find((s) => s.id === exec.scenarioId);
        const searchLower = searchQuery.toLowerCase();
        return (
          exec.id.toLowerCase().includes(searchLower) ||
          scenario?.name.toLowerCase().includes(searchLower) ||
          scenario?.description.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [executions, scenarios, filter, searchQuery]);

  const getScenarioName = useCallback((scenarioId: string) => {
    return scenarios.find((s) => s.id === scenarioId)?.name || 'Unknown Scenario';
  }, [scenarios]);

  const formatTimestamp = useCallback((timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  }, []);

  const formatDuration = useCallback((logs: DemoExecution['logs']) => {
    if (logs.length < 2) return '—';
    const start = new Date(logs[0].timestamp).getTime();
    const end = new Date(logs[logs.length - 1].timestamp).getTime();
    return `${end - start}ms`;
  }, []);

  return useMemo(() => ({
    executions: filteredExecutions,
    allExecutions: executions,
    scenarios,
    isLoading,
    error,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    selectedExecution,
    setSelectedExecution,
    getScenarioName,
    formatTimestamp,
    formatDuration,
    refresh: loadData,
  }), [
    filteredExecutions,
    executions,
    scenarios,
    isLoading,
    error,
    filter,
    searchQuery,
    selectedExecution,
    getScenarioName,
    formatTimestamp,
    formatDuration,
    loadData,
  ]);
}