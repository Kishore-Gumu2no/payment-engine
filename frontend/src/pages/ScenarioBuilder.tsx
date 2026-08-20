import { useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Plus, Trash2, Loader2, Upload, Server, Zap, ChevronRight, Copy, Check } from 'lucide-react';
import { useScenario } from '../hooks/useScenario.js';
import type { StepFormState, BuiltStep, CompiledStep, SelectOption } from '../types/index.js';
import { DEFAULT_FORM } from '../types/scenario.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Select,
  Textarea,
  Badge,
  Tabs,
  type Tab,
} from '../components/ui/index.js';
import './ScenarioBuilder.css';

export function ScenarioBuilder() {
  const navigate = useNavigate();
  const { compile, execute, executeManual, state } = useScenario();
  const { isCompiling, compileResult, compileError } = state;
  const [activeTab, setActiveTab] = useState<'ai' | 'manual'>('ai');

  // AI Compiler State
  const [prompt, setPrompt] = useState('');
  const [compiledSteps, setCompiledSteps] = useState<CompiledStep[]>([]);

  // Manual Builder State
  const [form, setForm] = useState<StepFormState>(DEFAULT_FORM);
  const [builtSteps, setBuiltSteps] = useState<BuiltStep[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const tabs: Tab[] = [
    { id: 'ai', label: 'AI Prompt Compiler', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'manual', label: 'Manual Step Builder', icon: <Server className="h-4 w-4" /> },
  ];

  const handleCompileScenario = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isCompiling) return;

    const result = await compile(trimmed);
    if (result.success && result.steps) {
      setCompiledSteps(result.steps);
    }
  }, [prompt, isCompiling, compile]);

  const handleAddStep = useCallback(() => {
    if (form.requestVolume < 1) return;

    const newStep: BuiltStep = {
      id: crypto.randomUUID(),
      ...form,
    };

    setBuiltSteps((prev) => [...prev, newStep]);
    setSyncMessage(null);
  }, [form]);

  const handleRemoveStep = useCallback((id: string) => {
    setBuiltSteps((prev) => prev.filter((step) => step.id !== id));
  }, []);

  const handleSyncScenario = useCallback(async () => {
    if (builtSteps.length === 0 || isSyncing) return;

    setIsSyncing(true);
    setSyncMessage(null);

    try {
      // In a real implementation, this would POST to /qa/scenario
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSyncMessage('Scenario synced to backend successfully (mock).');
    } catch (error) {
      setSyncMessage(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  }, [builtSteps.length, isSyncing]);

  const handleExecuteAI = useCallback(async () => {
    if (!compileResult?.steps) return;
    const result = await execute(compileResult.steps);
    if (result.success) {
      navigate('/execute', { state: { compiledSteps: compileResult.steps, logs: result.logs, metrics: result.metrics } });
    }
  }, [compileResult, execute, navigate]);

  const handleExecuteManual = useCallback(async () => {
    if (builtSteps.length === 0) return;
    const result = await executeManual(builtSteps);
    if (result.success) {
      navigate('/execute', { state: { builtSteps, logs: result.logs, metrics: result.metrics } });
    }
  }, [builtSteps, executeManual, navigate]);

  const copyPrompt = useCallback(async () => {
    await navigator.clipboard.writeText(prompt);
  }, [prompt]);

  const totalPlannedRequests = useMemo(
    () => (activeTab === 'ai' ? compiledSteps : builtSteps).reduce((sum, step) => sum + step.requestVolume, 0),
    [activeTab, compiledSteps, builtSteps]
  );

  const executionStrategyOptions: SelectOption[] = [
    { value: 'Sequential (Unique Keys)', label: 'Sequential (Unique Keys)' },
    { value: 'Concurrent Attack (Same Key)', label: 'Concurrent Attack (Same Key)' },
  ];

  const actionTypeOptions: SelectOption[] = [
    { value: 'PAYMENT', label: 'PAYMENT' },
    { value: 'REFUND', label: 'REFUND' },
  ];

  const expectedOutcomeOptions: SelectOption[] = [
    { value: '200_SUCCESS', label: '200_SUCCESS' },
    { value: '500_INTERNAL_ERROR', label: '500_INTERNAL_ERROR' },
    { value: 'TIMEOUT', label: 'TIMEOUT' },
  ];

  return (
    <div className="scenario-builder">
      <header className="page-header">
        <div className="header-left">
          <h1 className="page-title">Scenario Builder</h1>
          <p className="page-subtitle">
            Define test scenarios using AI natural language compilation or manual step configuration
          </p>
        </div>
        <div className="header-right">
          {(activeTab === 'ai' && compiledSteps.length > 0) || (activeTab === 'manual' && builtSteps.length > 0) ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/execute', { state: activeTab === 'ai' ? { compiledSteps } : { builtSteps } })}>
                <Zap className="h-4 w-4" />
                Go to Execute
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={(tabId: string) => setActiveTab(tabId as 'ai' | 'manual')} />

      {activeTab === 'ai' && (
        <div className="builder-content">
          <Card variant="default">
            <CardHeader>
              <CardTitle>
                <Sparkles className="h-5 w-5 text-acid-lime inline-block mr-2" />
                AI Prompt Compiler
              </CardTitle>
              <CardDescription>
                Describe your test scenario in plain English. The AI will compile it into a structured rulebook with payment/refund steps, volumes, and execution strategies.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <Textarea
                label="Plain-English Scenario"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                placeholder='e.g. "I want 100 payments of $50 to succeed, then an attack of 50 concurrent refunds on the same idempotency key to fail..."'
                disabled={isCompiling}
              />

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleCompileScenario}
                  disabled={!prompt.trim() || isCompiling}
                  loading={isCompiling}
                  icon={<Sparkles className="h-4 w-4" />}
                >
                  Compile Scenario via AI
                </Button>
                {prompt && (
                  <Button variant="ghost" onClick={copyPrompt} icon={<Copy className="h-4 w-4" />}>
                    Copy Prompt
                  </Button>
                )}
              </div>

              {compileError && (
                <div className="alert alert-error" role="alert">
                  {compileError}
                </div>
              )}

              {compileResult?.success && compileResult.steps && compileResult.steps.length > 0 && (
                <div className="compiled-preview">
                  <h3 className="preview-title">Compiled Steps ({compileResult.steps.length}) — Read-only Preview</h3>
                  <div className="steps-list">
                    {compileResult.steps.map((step: CompiledStep, index: number) => (
                      <div key={`${step.action}-${index}-${step.requestVolume}`} className="step-card">
                        <div className="step-header">
                          <span className="step-number">Step {index + 1}</span>
                          <Badge variant={step.action.toLowerCase() as 'payment' | 'refund'}>{step.action}</Badge>
                        </div>
                        <dl className="step-details">
                          {step.action === 'PAYMENT' && (
                            <div>
                              <dt>Amount</dt>
                              <dd className="font-berkeley-mono">${step.amount.toFixed(2)}</dd>
                            </div>
                          )}
                          <div>
                            <dt>Volume</dt>
                            <dd className="font-berkeley-mono">{step.requestVolume}</dd>
                          </div>
                          <div>
                            <dt>Strategy</dt>
                            <dd>{step.executionStrategy}</dd>
                          </div>
                        </dl>
                      </div>
                    ))}
                  </div>
                  <div className="preview-summary">
                    <span>Total planned requests: <strong className="text-paper">{totalPlannedRequests}</strong></span>
                    <Button
                      onClick={handleExecuteAI}
                      icon={<Zap className="h-4 w-4" />}
                      className="ml-auto"
                    >
                      Execute Test
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'manual' && (
        <div className="builder-content">
          <div className="builder-grid">
            <Card variant="default">
              <CardHeader>
                <CardTitle>
                  <Server className="h-5 w-5 text-acid-lime inline-block mr-2" />
                  Step Configuration
                </CardTitle>
                <CardDescription>
                  Configure each step of your scenario. Add multiple steps to build complex test sequences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Request Volume"
                    type="number"
                    min={1}
                    value={form.requestVolume}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        requestVolume: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                    placeholder="100"
                  />

                  <Select
                    label="Action Type"
                    value={form.actionType}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        actionType: e.target.value as 'PAYMENT' | 'REFUND',
                      }))
                    }
                    options={actionTypeOptions}
                    placeholder="Select action type"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="Expected Outcome"
                    value={form.expectedOutcome}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        expectedOutcome: e.target.value as '200_SUCCESS' | '500_INTERNAL_ERROR' | 'TIMEOUT',
                      }))
                    }
                    options={expectedOutcomeOptions}
                    placeholder="Select outcome"
                  />

                  <Select
                    label="Execution Strategy"
                    value={form.executionStrategy}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        executionStrategy: e.target.value as 'Sequential (Unique Keys)' | 'Concurrent Attack (Same Key)',
                      }))
                    }
                    options={executionStrategyOptions}
                    placeholder="Select strategy"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleAddStep} icon={<Plus className="h-4 w-4" />}>
                    Add Step
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleSyncScenario}
                    disabled={builtSteps.length === 0 || isSyncing}
                    loading={isSyncing}
                    icon={<Upload className="h-4 w-4" />}
                  >
                    Sync to Backend
                  </Button>
                </div>

                {syncMessage && (
                  <div className={`alert ${syncMessage.startsWith('Sync failed') ? 'alert-error' : 'alert-success'}`} role="alert">
                    {syncMessage}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    Scenario Steps ({builtSteps.length})
                  </CardTitle>
                  {builtSteps.length > 0 && (
                    <span className="text-caption text-fog">
                      Total: <span className="text-paper font-berkeley-mono">{totalPlannedRequests}</span> requests
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {builtSteps.length === 0 ? (
                  <div className="empty-state">
                    <Server className="h-12 w-12 text-ash mx-auto mb-4" />
                    <h3 className="text-body font-w510 text-paper text-center">No steps added yet</h3>
                    <p className="text-body-sm text-fog text-center mt-1">
                      Configure and add steps using the form on the left.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="steps-list">
                      {builtSteps.map((step, index) => (
                        <div key={step.id} className="step-card">
                          <div className="step-header">
                            <span className="step-number">Step {index + 1}</span>
                            <Badge variant={step.actionType.toLowerCase() as 'payment' | 'refund'}>{step.actionType}</Badge>
                          </div>
                          <dl className="step-details">
                            <div>
                              <dt>Volume</dt>
                              <dd className="font-berkeley-mono">{step.requestVolume}</dd>
                            </div>
                            <div>
                              <dt>Outcome</dt>
                              <dd>{step.expectedOutcome}</dd>
                            </div>
                            <div>
                              <dt>Strategy</dt>
                              <dd>{step.executionStrategy}</dd>
                            </div>
                          </dl>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveStep(step.id)}
                            aria-label={`Remove step ${index + 1}`}
                            icon={<Trash2 className="h-4 w-4" />}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="preview-summary mt-6 pt-6 border-t border-graphite">
                      <span>Total planned requests: <strong className="text-paper">{totalPlannedRequests}</strong></span>
                      <Button
                        onClick={handleExecuteManual}
                        icon={<Zap className="h-4 w-4" />}
                        className="ml-auto"
                      >
                        Execute Test
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

