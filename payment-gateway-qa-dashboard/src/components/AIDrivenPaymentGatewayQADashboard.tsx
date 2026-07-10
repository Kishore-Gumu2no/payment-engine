import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  Bot,
  Crosshair,
  Loader2,
  RefreshCw,
  Rocket,
  Sparkles,
  Terminal,
} from 'lucide-react'

const API_BASE = 'https://payment-engine-ai-ah4os.ondigitalocean.app'

type ActionType = 'PAYMENT' | 'REFUND'

interface CompiledStep {
  action: ActionType
  amount: number
  requestVolume: number
  executionStrategy: string
}

interface LogEntry {
  status: number
  message: string
  timestamp: string
  action?: ActionType
}

function generateUuid(): string {
  return crypto.randomUUID()
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

function isConcurrentAttack(strategy: string): boolean {
  return strategy.toLowerCase().includes('concurrent')
}

function normalizeCompiledSteps(data: unknown): CompiledStep[] {
  if (!Array.isArray(data)) {
    throw new Error('Backend returned an invalid response — expected a JSON array of steps.')
  }

  return data.map((raw, index) => {
    const step = raw as Record<string, unknown>
    const action = String(step.action ?? step.actionType ?? '').toUpperCase()

    if (action !== 'PAYMENT' && action !== 'REFUND') {
      throw new Error(`Step ${index + 1} has an invalid action: "${action}"`)
    }

    const requestVolume = Number(step.requestVolume ?? step.volume)
    const amount = Number(step.amount ?? 0)

    if (!Number.isFinite(requestVolume) || requestVolume < 1) {
      throw new Error(`Step ${index + 1} has an invalid request volume.`)
    }

    if (action === 'PAYMENT' && (!Number.isFinite(amount) || amount <= 0)) {
      throw new Error(`Step ${index + 1} is missing a valid payment amount.`)
    }

    const executionStrategy = String(
      step.executionStrategy ?? step.strategy ?? 'Sequential',
    )

    return {
      action: action as ActionType,
      amount,
      requestVolume,
      executionStrategy,
    }
  })
}

export default function AIDrivenPaymentGatewayQADashboard() {
  const [prompt, setPrompt] = useState('')
  const [compiledSteps, setCompiledSteps] = useState<CompiledStep[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isCompiling, setIsCompiling] = useState(false)
  const [isFiring, setIsFiring] = useState(false)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [compileNotice, setCompileNotice] = useState<string | null>(null)

  const appendLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev, entry])
  }, [])

  const metrics = useMemo(
    () => ({
      total: logs.length,
      ok200: logs.filter((l) => l.status === 200).length,
      conflict409: logs.filter((l) => l.status === 409).length,
      error500: logs.filter((l) => l.status === 500).length,
      refundsProcessed: logs.filter(
        (l) => l.status === 200 && l.action === 'REFUND',
      ).length,
    }),
    [logs],
  )

  const totalPlannedRequests = compiledSteps.reduce(
    (sum, step) => sum + step.requestVolume,
    0,
  )

  const handleCompileScenario = async () => {
    const trimmed = prompt.trim()
    if (!trimmed || isCompiling) return

    setIsCompiling(true)
    setCompileError(null)
    setCompileNotice(null)
    setCompiledSteps([])

    try {
      const response = await fetch(`${API_BASE}/qa/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
      })

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new Error(
          `Compile failed (${response.status}): server returned a non-JSON response.`,
        )
      }

      if (!response.ok) {
        const detail =
          typeof payload === 'object' &&
          payload !== null &&
          'message' in payload
            ? String((payload as { message: unknown }).message)
            : `HTTP ${response.status}`
        throw new Error(detail)
      }

      const steps = normalizeCompiledSteps(payload)
      setCompiledSteps(steps)
      setCompileNotice(
        `AI compiled ${steps.length} step${steps.length === 1 ? '' : 's'} — review below before firing.`,
      )
    } catch (error) {
      if (error instanceof TypeError) {
        setCompileError(
          'Network error — is the backend running at http://localhost:3000? Check CORS if the server is up.',
        )
      } else {
        setCompileError(
          error instanceof Error ? error.message : 'Unknown compile error.',
        )
      }
    } finally {
      setIsCompiling(false)
    }
  }

  const handleFireCannon = async () => {
    if (compiledSteps.length === 0 || isFiring) return

    setIsFiring(true)
    setLogs([])

    const requests: Promise<Response>[] = []

    for (const step of compiledSteps) {
      const endpoint =
        step.action === 'PAYMENT'
          ? `${API_BASE}/payment`
          : `${API_BASE}/refund`

      const bodyForRequest = (idempotencyKey: string) =>
        step.action === 'PAYMENT'
          ? { amount: step.amount, idempotencyKey }
          : { originalTransactionId: 'txn_123', idempotencyKey }

      if (isConcurrentAttack(step.executionStrategy)) {
        const sharedKey = generateUuid()

        for (let i = 0; i < step.requestVolume; i++) {
          requests.push(
            fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(bodyForRequest(sharedKey)),
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
                message: `[${step.action}] ${message}`,
                timestamp: formatTimestamp(),
                action: step.action,
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
              body: JSON.stringify(bodyForRequest(uniqueKey)),
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
                message: `[${step.action}] ${message}`,
                timestamp: formatTimestamp(),
                action: step.action,
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
          error instanceof TypeError
            ? 'Network/CORS error during batch — verify backend connectivity.'
            : error instanceof Error
              ? `Batch error: ${error.message}`
              : 'Batch error: Unknown failure',
        timestamp: formatTimestamp(),
      })
    } finally {
      setIsFiring(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10">
        {/* Header */}
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-500/20 p-3">
              <Bot className="h-7 w-7 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                AI-Driven Payment Gateway QA Dashboard
              </h1>
              <p className="text-sm text-slate-400">
                Describe scenarios in plain English, compile with AI, then
                stress-test idempotency at scale.
              </p>
            </div>
          </div>
        </header>

        {/* Zone 1: AI Prompt Compiler */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          <div className="mb-6 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            <h2 className="text-lg font-semibold">AI Prompt Compiler</h2>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Plain-English Scenario
            </span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              placeholder={`e.g. "I want 100 payments of $50 to succeed, then an attack of 50 concurrent refunds on the same idempotency key to fail..."`}
              className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-relaxed outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
            />
          </label>

          <button
            type="button"
            onClick={handleCompileScenario}
            disabled={!prompt.trim() || isCompiling}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCompiling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Compile Scenario via AI
          </button>

          {compileError && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {compileError}
            </p>
          )}

          {compileNotice && !compileError && (
            <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
              {compileNotice}
            </p>
          )}

          {compiledSteps.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-medium text-slate-300">
                Compiled Steps ({compiledSteps.length}) — read-only preview
              </h3>
              {compiledSteps.map((step, index) => (
                <div
                  key={`${step.action}-${index}-${step.requestVolume}`}
                  className="rounded-xl border border-slate-800 bg-slate-950/80 p-4"
                >
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-violet-400">
                    Step {index + 1}
                  </p>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">Action</dt>
                      <dd className="font-medium text-slate-200">
                        {step.action}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Amount</dt>
                      <dd className="font-medium text-slate-200">
                        {step.action === 'PAYMENT'
                          ? `$${step.amount.toFixed(2)}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Volume</dt>
                      <dd className="font-medium text-slate-200">
                        {step.requestVolume}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Strategy</dt>
                      <dd className="font-medium text-slate-200">
                        {step.executionStrategy}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Zone 2: Concurrency Cannon Engine */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          <div className="mb-4 flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-orange-400" />
            <h2 className="text-lg font-semibold">Concurrency Cannon Engine</h2>
          </div>

          <p className="mb-6 text-sm text-slate-400">
            Executes every compiled step concurrently via{' '}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-orange-300">
              Promise.all
            </code>
            . Concurrent Attack steps share one idempotency key; Sequential steps
            generate a unique key per request.
          </p>

          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-300">
            <p>
              Planned batch size:{' '}
              <span className="font-semibold text-white">
                {totalPlannedRequests}
              </span>{' '}
              requests across {compiledSteps.length} compiled step
              {compiledSteps.length === 1 ? '' : 's'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleFireCannon}
            disabled={compiledSteps.length === 0 || isFiring}
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

        {/* Zone 3: Live Terminal Output & Metrics */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          <div className="mb-6 flex items-center gap-2">
            <Terminal className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold">
              Live Terminal Output &amp; Metrics
            </h2>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
            <MetricCard
              label="Total Refunds Processed"
              value={metrics.refundsProcessed}
              icon={<Activity className="h-4 w-4 text-cyan-400" />}
              accent="text-cyan-400"
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
