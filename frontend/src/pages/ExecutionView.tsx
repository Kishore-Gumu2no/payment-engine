import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Rocket, Loader2, Terminal, Trash2, Download, RefreshCw, Activity, AlertTriangle, CheckCircle, XCircle, ChevronLeft, Zap } from 'lucide-react';
import { useScenario } from '../hooks/useScenario.js';
import type { CompiledStep, BuiltStep, LogEntry, ExecutionMetrics, TerminalRef } from '../types/index.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  MetricCard,
  Terminal as TerminalComponent,
} from '../components/ui/index.js';
import './ExecutionView.css';

export function ExecutionView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { execute, executeManual, state } = useScenario();
  const terminalRef = useRef<TerminalRef>(null);

  // State from scenario builder (passed via location.state)
  const [compiledSteps, setCompiledSteps] = useState<CompiledStep[]>([]);
  const [builtSteps, setBuiltSteps] = useState<BuiltStep[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isFiring, setIsFiring] = useState(false);
  const [fireError, setFireError] = useState<string | null>(null);

  const metrics = useMemo(() => ({
    total: logs.length,
    ok200: logs.filter(l => l.status === 200).length,
    conflict409: logs.filter(l => l.status === 409).length,
    error500: logs.filter(l => l.status >= 500).length,
    refundsProcessed: logs.filter(l => l.status === 200 && l.action === 'REFUND').length,
  }), [logs]);

  const totalPlannedRequests = useMemo(() => {
    const steps = compiledSteps.length > 0 ? compiledSteps : builtSteps;
    return steps.reduce((sum, step) => sum + step.requestVolume, 0);
  }, [compiledSteps, builtSteps]);

  const hasSteps = compiledSteps.length > 0 || builtSteps.length > 0;

  // Read state from location
  useEffect(() => {
    const state = location.state as { compiledSteps?: CompiledStep[]; builtSteps?: BuiltStep[]; logs?: LogEntry[]; metrics?: ExecutionMetrics } | null;
    if (state) {
      if (state.compiledSteps) setCompiledSteps(state.compiledSteps);
      if (state.builtSteps) setBuiltSteps(state.builtSteps);
      if (state.logs) setLogs(state.logs);
      if (state.metrics) {
        // Metrics are computed from logs, so this is just for initial load
      }
    }
  }, [location.state]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollToBottom();
    }
  }, [logs]);

  const handleFireCannon = useCallback(async () => {
    const steps = compiledSteps.length > 0 ? compiledSteps : builtSteps;
    if (steps.length === 0 || isFiring) return;

    setIsFiring(true);
    setLogs([]);
    setFireError(null);

    try {
      // Convert to CompiledStep format for execution
      const stepsToExecute: CompiledStep[] = compiledSteps.length > 0
        ? compiledSteps
        : builtSteps.map(step => ({
            action: step.actionType,
            amount: step.actionType === 'PAYMENT' ? 100 : 0,
            requestVolume: step.requestVolume,
            executionStrategy: step.executionStrategy,
          }));

      const result = await execute(stepsToExecute);

      if (result.success) {
        setLogs(result.logs);
      } else {
        setFireError(result.error || 'Execution failed');
        if (result.logs.length > 0) setLogs(result.logs);
      }
    } catch (error) {
      setFireError(error instanceof Error ? error.message : 'Execution failed');
    } finally {
      setIsFiring(false);
    }
  }, [compiledSteps, builtSteps, isFiring, execute]);

  const handleClear = useCallback(() => {
    setLogs([]);
    setFireError(null);
  }, []);

  const handleDownloadLogs = useCallback(() => {
    const logText = logs.map(log => `[${log.timestamp}] ${log.status} ${log.message}`).join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  const getStatusClass = (status: number) => {
    if (status >= 200 && status < 300) return 'success';
    if (status === 409) return 'warning';
    if (status >= 500) return 'error';
    return 'default';
  };

  return (
    <div className="execution-view">
      <header className="page-header">
        <div className="header-left">
          <Button variant="ghost" size="sm" onClick={() => navigate('/builder')} icon={<ChevronLeft className="h-4 w-4" />}>
            Back to Builder
          </Button>
          <h1 className="page-title">Execute Scenario</h1>
          <p className="page-subtitle">
            Fire concurrent payment/refund requests with configurable idempotency key strategies
          </p>
        </div>
      </header>

      {!hasSteps && (
        <Card variant="subtle" className="empty-state-card">
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <Terminal className="h-12 w-12 text-ash" />
            <div>
              <h2 className="text-heading-sm font-w510 text-paper">No Scenario Loaded</h2>
              <p className="text-body-sm text-fog mt-1">
                Create a scenario in the <strong>Scenario Builder</strong> first, then return here to execute it.
              </p>
            </div>
            <Link to="/builder">
              <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
                Create Scenario
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {hasSteps && (
        <>
          {/* Scenario Summary */}
          <Card variant="default" className="scenario-summary">
            <CardHeader>
              <CardTitle>Scenario Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="summary-cards">
                <div className="summary-card">
                  <span className="summary-label">Steps</span>
                  <span className="summary-value">{compiledSteps.length + builtSteps.length}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Planned Requests</span>
                  <span className="summary-value font-berkeley-mono">{totalPlannedRequests}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Strategy</span>
                  <span className="summary-value">
                    {compiledSteps.some(s => s.executionStrategy.toLowerCase().includes('concurrent')) ||
                     builtSteps.some(s => s.executionStrategy.includes('Concurrent Attack'))
                      ? 'Mixed (Concurrent + Sequential)'
                      : 'Sequential (Unique Keys)'}
                  </span>
                </div>
              </div>

              <div className="steps-preview mt-6 pt-6 border-t border-graphite">
                <h3 className="preview-title">Steps to Execute</h3>
                <div className="steps-list">
                  {compiledSteps.map((step, index) => (
                    <div key={`compiled-${index}`} className="step-item">
                      <span className="step-index">{index + 1}</span>
                      <Badge variant={step.action.toLowerCase() as 'payment' | 'refund'}>{step.action}</Badge>
                      <span className="step-volume font-berkeley-mono">×{step.requestVolume}</span>
                      <span className="step-strategy">{step.executionStrategy}</span>
                    </div>
                  ))}
                  {builtSteps.map((step, index) => (
                    <div key={`built-${step.id}`} className="step-item">
                      <span className="step-index">{compiledSteps.length + index + 1}</span>
                      <Badge variant={step.actionType.toLowerCase() as 'payment' | 'refund'}>{step.actionType}</Badge>
                      <span className="step-volume font-berkeley-mono">×{step.requestVolume}</span>
                      <span className="step-strategy">{step.executionStrategy}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Execution Controls */}
          <Card variant="default" className="execution-controls">
            <CardHeader>
              <CardTitle>
                <Zap className="h-5 w-5 text-coral-red inline-block mr-2" />
                Concurrency Cannon
              </CardTitle>
              <CardDescription>
                Executes all steps concurrently via <code className="bg-graphite px-1.5 py-0.5 rounded text-[11px] font-berkeley-mono text-acid-lime">Promise.all</code>.
                Concurrent Attack steps share one idempotency key; Sequential steps generate unique keys per request.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="batch-info">
                Planned batch size: <strong className="text-paper font-berkeley-mono">{totalPlannedRequests}</strong> requests across <strong className="text-paper">{compiledSteps.length + builtSteps.length}</strong> step(s)
              </div>

              <Button
                onClick={handleFireCannon}
                disabled={isFiring || !hasSteps}
                loading={isFiring}
                variant="destructive"
                size="xl"
                fullWidth
                icon={<Rocket className="h-6 w-6" />}
                className="mt-6 cannon-btn"
              >
                {isFiring ? 'Cannon In Flight…' : 'Fire Cannon'}
              </Button>

              {fireError && (
                <div className="alert alert-error mt-4" role="alert">
                  <AlertTriangle className="h-4 w-4 inline-block mr-2" />
                  {fireError}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Section */}
          <section className="results-section" aria-labelledby="results-heading">
            <div className="section-header">
              <h2 id="results-heading" className="section-title">
                <Terminal className="h-5 w-5 text-acid-lime" />
                Live Terminal & Metrics
              </h2>
              <div className="section-actions">
                {logs.length > 0 && (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleClear} icon={<Trash2 className="h-4 w-4" />}>
                      Clear
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDownloadLogs} icon={<Download className="h-4 w-4" />}>
                      Download
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Metrics Cards */}
            <div className="metrics-grid" role="region" aria-label="Execution metrics">
              <MetricCard
                label="Total Requests Sent"
                value={metrics.total}
                icon={<RefreshCw className="h-5 w-5 text-sky-400" />}
              />
              <MetricCard
                label="200 OK"
                value={metrics.ok200}
                icon={<CheckCircle className="h-5 w-5" />}
                accent="success"
              />
              <MetricCard
                label="409 Conflict"
                value={metrics.conflict409}
                icon={<AlertTriangle className="h-5 w-5" />}
                accent="warning"
              />
              <MetricCard
                label="500 Error"
                value={metrics.error500}
                icon={<XCircle className="h-5 w-5" />}
                accent="error"
              />
              <MetricCard
                label="Refunds Processed"
                value={metrics.refundsProcessed}
                icon={<Activity className="h-5 w-5" />}
                accent="info"
              />
            </div>

            {/* Terminal */}
            <Card variant="elevated" className="terminal-card">
              <TerminalComponent
                ref={terminalRef}
                logs={logs}
                autoScroll={true}
                maxHeight="500px"
                showTimestamp={true}
                showStatus={true}
              />
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';