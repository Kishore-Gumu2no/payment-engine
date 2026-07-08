import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  Crosshair,
  Loader2,
  Plus,
  RefreshCw,
  Rocket,
  Server,
  Terminal,
  Trash2,
  Upload,
} from 'lucide-react'

type ActionType = 'PAYMENT' | 'REFUND'
type ExpectedOutcome = '200_SUCCESS' | '500_INTERNAL_ERROR' | 'TIMEOUT'
type ExecutionStrategy =
  | 'Sequential (Unique Keys)'
  | 'Concurrent Attack (Same Key)'

interface ScenarioStep {
  id: string
  requestVolume: number
  actionType: ActionType
  expectedOutcome: ExpectedOutcome
  executionStrategy: ExecutionStrategy
}

interface LogEntry {
  status: number
  message: string
  timestamp: string
}

interface StepFormState {
  requestVolume: number
  actionType: ActionType
  expectedOutcome: ExpectedOutcome
  executionStrategy: ExecutionStrategy
}

const API_BASE = 'http://localhost:3000'

const DEFAULT_FORM: StepFormState = {
  requestVolume: 100,
  actionType: 'PAYMENT',
  expectedOutcome: '200_SUCCESS',
  executionStrategy: 'Sequential (Unique Keys)',
}

function generateUuid(): string {
  return crypto.randomUUID()
}

function mapOutcomeToMockResponse(outcome: ExpectedOutcome) {
  switch (outcome) {
    case '200_SUCCESS':
      return { httpStatus: 200, body: { message: 'Success' } }
    case '500_INTERNAL_ERROR':
      return { httpStatus: 500, body: { message: 'Internal Server Error' } }
    case 'TIMEOUT':
      return { httpStatus: 408, body: { message: 'Request Timeout' }, timeout: true }
  }
}

function formatTimestamp(date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 23)
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-emerald-400'
  if (status === 409) return 'text-amber-400'
  if (status >= 500) return 'text-red-400'
  return 'text-slate-300'
}

export default function PaymentGatewayQADashboard() {
  const [form, setForm] = useState<StepFormState>(DEFAULT_FORM)
  const [steps, setSteps] = useState<ScenarioStep[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [isFiring, setIsFiring] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const metrics = useMemo(
    () => ({
      total: logs.length,
      ok200: logs.filter((l) => l.status === 200).length,
      conflict409: logs.filter((l) => l.status === 409).length,
      error500: logs.filter((l) => l.status === 500).length,
    }),
    [logs],
  )

  const appendLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev, entry])
  }, [])

  const handleAddStep = () => {
    if (form.requestVolume < 1) return

    setSteps((prev) => [
      ...prev,
      {
        id: generateUuid(),
        ...form,
      },
    ])
    setSyncMessage(null)
  }

  const handleRemoveStep = (id: string) => {
    setSteps((prev) => prev.filter((step) => step.id !== id))
  }

  const handleSyncScenario = async () => {
    if (steps.length === 0) return

    setIsSyncing(true)
    setSyncMessage(null)

    const payload = steps.map((step) => ({
      requestVolume: step.requestVolume,
      actionType: step.actionType,
      expectedOutcome: step.expectedOutcome,
      executionStrategy: step.executionStrategy,
      mockResponse: mapOutcomeToMockResponse(step.expectedOutcome),
    }))

    try {
      const response = await fetch('/api/qa/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Sync failed with status ${response.status}`)
      }

      setSyncMessage('Scenario synced to backend successfully.')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown sync error'
      setSyncMessage(`Sync failed: ${message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleFireCannon = async () => {
    if (steps.length === 0 || isFiring) return

    setIsFiring(true)
    setLogs([])

    const requests: Promise<Response>[] = []

    for (const step of steps) {
      const endpoint =
        step.actionType === 'PAYMENT'
          ? `${API_BASE}/payment`
          : `${API_BASE}/refund`

      const bodyForAction = (idempotencyKey: string) =>
        step.actionType === 'PAYMENT'
          ? { amount: 100, idempotencyKey }
          : { originalTransactionId: 'txn_123', idempotencyKey }

      if (step.executionStrategy === 'Concurrent Attack (Same Key)') {
        const sharedKey = generateUuid()

        for (let i = 0; i < step.requestVolume; i++) {
          requests.push(
            fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(bodyForAction(sharedKey)),
            }).then(async (response) => {
              let message: string
              try {
                const data = await response.json()
                message = JSON.stringify(data)
              } catch {
                message = response.statusText || 'No response body'
              }

              appendLog({
                status: response.status,
                message: `[${step.actionType}] ${message}`,
                timestamp: formatTimestamp(),
              })

              return response
            }),
          )
        }
      } else {
        for (let i = 0; i < step.requestVolume; i++) {
          const uniqueKey = generateUuid()

          requests.push(
            fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(bodyForAction(uniqueKey)),
            }).then(async (response) => {
              let message: string
              try {
                const data = await response.json()
                message = JSON.stringify(data)
              } catch {
                message = response.statusText || 'No response body'
              }

              appendLog({
                status: response.status,
                message: `[${step.actionType}] ${message}`,
                timestamp: formatTimestamp(),
              })

              return response
            }),
          )
        }
      }
    }

    try {
      await Promise.all(requests)
    } catch (error) {
      appendLog({
        status: 0,
        message:
          error instanceof Error
            ? `Batch error: ${error.message}`
            : 'Batch error: Unknown failure',
        timestamp: formatTimestamp(),
      })
    } finally {
      setIsFiring(false)
    }
  }

  const totalPlannedRequests = steps.reduce(
    (sum, step) => sum + step.requestVolume,
    0,
  )

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10">
        {/* Header */}
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-500/20 p-3">
              <Activity className="h-7 w-7 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Stateful Payment Gateway QA Dashboard
              </h1>
              <p className="text-sm text-slate-400">
                Build scenarios, sync mocks, and stress-test idempotency
                behavior.
              </p>
            </div>
          </div>
        </header>

        {/* Section 1: Dynamic Scenario Builder */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          <div className="mb-6 flex items-center gap-2">
            <Server className="h-5 w-5 text-sky-400" />
            <h2 className="text-lg font-semibold">Dynamic Scenario Builder</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Request Volume
              </span>
              <input
                type="number"
                min={1}
                value={form.requestVolume}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    requestVolume: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none ring-indigo-500/0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                placeholder="100"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Action Type
              </span>
              <select
                value={form.actionType}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    actionType: e.target.value as ActionType,
                  }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="PAYMENT">PAYMENT</option>
                <option value="REFUND">REFUND</option>
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Expected Outcome
              </span>
              <select
                value={form.expectedOutcome}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    expectedOutcome: e.target.value as ExpectedOutcome,
                  }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="200_SUCCESS">200_SUCCESS</option>
                <option value="500_INTERNAL_ERROR">500_INTERNAL_ERROR</option>
                <option value="TIMEOUT">TIMEOUT</option>
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Execution Strategy
              </span>
              <select
                value={form.executionStrategy}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    executionStrategy: e.target.value as ExecutionStrategy,
                  }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="Sequential (Unique Keys)">
                  Sequential (Unique Keys)
                </option>
                <option value="Concurrent Attack (Same Key)">
                  Concurrent Attack (Same Key)
                </option>
              </select>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleAddStep}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium transition hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              Add Step
            </button>

            <button
              type="button"
              onClick={handleSyncScenario}
              disabled={steps.length === 0 || isSyncing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-medium transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Sync Scenario to Backend
            </button>
          </div>

          {syncMessage && (
            <p
              className={`mt-4 text-sm ${syncMessage.startsWith('Sync failed') ? 'text-red-400' : 'text-emerald-400'}`}
            >
              {syncMessage}
            </p>
          )}

          {steps.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-medium text-slate-300">
                Scenario Steps ({steps.length})
              </h3>
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/80 p-4"
                >
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-slate-200">
                      Step {index + 1}: {step.actionType}
                    </p>
                    <p className="text-slate-400">
                      Volume: {step.requestVolume} · Outcome:{' '}
                      {step.expectedOutcome}
                    </p>
                    <p className="text-slate-500">{step.executionStrategy}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveStep(step.id)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
                    aria-label={`Remove step ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Concurrency Cannon Engine */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          <div className="mb-4 flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-orange-400" />
            <h2 className="text-lg font-semibold">Concurrency Cannon Engine</h2>
          </div>

          <p className="mb-6 text-sm text-slate-400">
            Fires all scenario steps concurrently via{' '}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-orange-300">
              Promise.all
            </code>
            . Concurrent Attack steps reuse a single idempotency key; Sequential
            steps generate a unique key per request.
          </p>

          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-300">
            <p>
              Planned batch size:{' '}
              <span className="font-semibold text-white">
                {totalPlannedRequests}
              </span>{' '}
              requests across {steps.length} step
              {steps.length === 1 ? '' : 's'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleFireCannon}
            disabled={steps.length === 0 || isFiring}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-orange-600 to-red-600 px-8 py-5 text-lg font-bold tracking-wide shadow-lg shadow-orange-900/40 transition hover:from-orange-500 hover:to-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isFiring ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                Cannon In Flight…
              </>
            ) : (
              <>
                <Rocket className="h-6 w-6" />
                Fire Cannon
              </>
            )}
          </button>
        </section>

        {/* Section 3: Live Terminal Output & Metrics */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          <div className="mb-6 flex items-center gap-2">
            <Terminal className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold">
              Live Terminal Output &amp; Metrics
            </h2>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label="Total Requests Sent"
              value={metrics.total}
              icon={<RefreshCw className="h-4 w-4 text-sky-400" />}
            />
            <MetricCard
              label="200 OK Count"
              value={metrics.ok200}
              icon={<Activity className="h-4 w-4 text-emerald-400" />}
              accent="text-emerald-400"
            />
            <MetricCard
              label="409 Conflict Count"
              value={metrics.conflict409}
              icon={<Activity className="h-4 w-4 text-amber-400" />}
              accent="text-amber-400"
            />
            <MetricCard
              label="500 Error Count"
              value={metrics.error500}
              icon={<Activity className="h-4 w-4 text-red-400" />}
              accent="text-red-400"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950 px-4 py-2.5">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-xs font-medium text-slate-500">
                qa-terminal
              </span>
            </div>

            <div className="max-h-96 overflow-y-auto bg-[#0d1117] p-4 font-mono text-xs leading-relaxed">
              {logs.length === 0 ? (
                <p className="text-slate-600">
                  // Waiting for cannon fire… responses will stream here.
                </p>
              ) : (
                logs.map((log, index) => (
                  <div key={`${log.timestamp}-${index}`} className="mb-2">
                    <span className="text-slate-500">[{log.timestamp}]</span>{' '}
                    <span className={statusColor(log.status)}>
                      {log.status || 'ERR'}
                    </span>{' '}
                    <span className="text-slate-300">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon,
  accent = 'text-white',
}: {
  label: string
  value: number
  icon: ReactNode
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
        {icon}
        {label}
      </div>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  )
}
