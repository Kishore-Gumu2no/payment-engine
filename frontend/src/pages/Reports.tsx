import { useState, useMemo } from 'react';
import { Download, RefreshCw, TrendingUp, BarChart2, Clock, DollarSign, CheckCircle, AlertTriangle } from 'lucide-react';
import { useHistory } from '../hooks/useHistory.js';
import { MODE } from '../config/mode.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Select,
  Tabs,
} from '../components/ui/index.js';
import './Reports.css';

export function Reports() {
  const { executions, allExecutions, isLoading, error, refresh } = useHistory();
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('all');
  const [activeTab, setActiveTab] = useState('overview');

  const filteredExecutions = useMemo(() => {
    const now = Date.now();
    const ranges = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      'all': Infinity,
    };
    const cutoff = now - ranges[timeRange];
    return allExecutions.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
  }, [allExecutions, timeRange]);

  const aggregateMetrics = useMemo(() => {
    return filteredExecutions.reduce(
      (acc, exec) => ({
        total: acc.total + exec.metrics.total,
        ok200: acc.ok200 + exec.metrics.ok200,
        conflict409: acc.conflict409 + exec.metrics.conflict409,
        error500: acc.error500 + exec.metrics.error500,
        refundsProcessed: acc.refundsProcessed + exec.metrics.refundsProcessed,
        totalAmount: acc.totalAmount + exec.metrics.totalAmount,
        totalRefundAmount: acc.totalRefundAmount + exec.metrics.totalRefundAmount,
      }),
      {
        total: 0,
        ok200: 0,
        conflict409: 0,
        error500: 0,
        refundsProcessed: 0,
        totalAmount: 0,
        totalRefundAmount: 0,
      }
    );
  }, [filteredExecutions]);

  const successRate = aggregateMetrics.total > 0
    ? ((aggregateMetrics.ok200 / aggregateMetrics.total) * 100).toFixed(2)
    : '0.00';

  const conflictRate = aggregateMetrics.total > 0
    ? ((aggregateMetrics.conflict409 / aggregateMetrics.total) * 100).toFixed(2)
    : '0.00';

  const scenarioBreakdown = useMemo(() => {
    const breakdown: Record<string, { count: number; total: number; ok: number; conflicts: number }> = {};
    filteredExecutions.forEach((exec) => {
      const key = exec.scenarioId;
      if (!breakdown[key]) {
        breakdown[key] = { count: 0, total: 0, ok: 0, conflicts: 0 };
      }
      breakdown[key].count += 1;
      breakdown[key].total += exec.metrics.total;
      breakdown[key].ok += exec.metrics.ok200;
      breakdown[key].conflicts += exec.metrics.conflict409;
    });
    return breakdown;
  }, [filteredExecutions]);

  const statusDistribution = useMemo(() => [
    { label: '200 OK', value: aggregateMetrics.ok200, color: 'var(--color-pulse-green)' },
    { label: '409 Conflict', value: aggregateMetrics.conflict409, color: 'var(--color-coral-red)' },
    { label: '500 Error', value: aggregateMetrics.error500, color: 'color-mix(in srgb, var(--color-coral-red) 70%, transparent)' },
  ], [aggregateMetrics]);

  const totalRequests = statusDistribution.reduce((sum, s) => sum + s.value, 0);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'latency', label: 'Latency' },
    { id: 'scenarios', label: 'By Scenario' },
  ];

  return (
    <div className="reports-page">
      <header className="page-header">
        <div className="header-left">
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">
            Analyze test execution trends, success rates, and failure patterns
          </p>
        </div>
        <div className="header-right">
          <div className="flex items-center gap-3">
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              options={[
                { value: '24h', label: 'Last 24h' },
                { value: '7d', label: 'Last 7 days' },
                { value: '30d', label: 'Last 30 days' },
                { value: 'all', label: 'All time' },
              ]}
              className="time-range-select"
            />
            <Button variant="ghost" onClick={refresh} loading={isLoading} icon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
            <Button variant="ghost" icon={<Download className="h-4 w-4" />}>
              Export Report
            </Button>
          </div>
        </div>
      </header>

      {MODE.isDemo && (
        <div className="demo-banner">
          <BarChart2 className="h-4 w-4" />
          <span>Showing <strong>pre-generated demo data</strong>. Set VITE_DEMO_MODE=false for live analytics.</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertTriangle className="h-4 w-4 inline-block mr-2" />
          {error}
          <Button variant="ghost" size="sm" onClick={refresh} className="ml-4">
            Retry
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard
          icon={<CheckCircle className="h-5 w-5 text-pulse-green" />}
          label="Success Rate"
          value={`${successRate}%`}
          trend={{ value: '+2.1%', positive: true }}
          description="vs previous period"
        />
        <KPICard
          icon={<AlertTriangle className="h-5 w-5 text-coral-red" />}
          label="Conflict Rate"
          value={`${conflictRate}%`}
          trend={{ value: '-0.5%', positive: true }}
          description="409 idempotency conflicts"
        />
        <KPICard
          icon={<DollarSign className="h-5 w-5 text-signal-teal" />}
          label="Volume Processed"
          value={`$${(aggregateMetrics.totalAmount / 100).toLocaleString()}`}
          trend={{ value: '+12.3%', positive: true }}
          description="Total payment amount"
        />
        <KPICard
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          label="Avg Latency"
          value={`${142}ms`}
          trend={{ value: '-8ms', positive: true }}
          description="P50: 118ms · P95: 342ms"
        />
      </div>

      {/* Tabs for different report views */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="w-full mb-6" />

      {activeTab === 'overview' && (
        <div className="reports-tab-content">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Status Distribution */}
            <Card variant="default">
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {statusDistribution.map((status) => (
                    <StatusBar
                      key={status.label}
                      label={status.label}
                      value={status.value}
                      total={totalRequests}
                      color={status.color}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Trend Chart Placeholder */}
            <Card variant="default">
              <CardHeader>
                <CardTitle>Request Volume Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-obsidian border border-graphite rounded-card flex items-center justify-center">
                  <div className="text-center p-8">
                    <BarChart2 className="h-12 w-12 mx-auto text-ash mb-4" />
                    <p className="text-fog">Time-series chart</p>
                    <p className="text-caption text-ash mt-1">(Chart library integration pending)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Metrics Grid */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>Aggregated Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="metrics-detail-grid">
                <MetricDetail label="Total Requests" value={aggregateMetrics.total.toLocaleString()} />
                <MetricDetail label="Successful (200)" value={aggregateMetrics.ok200.toLocaleString()} accent="success" />
                <MetricDetail label="Conflicts (409)" value={aggregateMetrics.conflict409.toLocaleString()} accent="warning" />
                <MetricDetail label="Errors (500)" value={aggregateMetrics.error500.toLocaleString()} accent="error" />
                <MetricDetail label="Refunds Processed" value={aggregateMetrics.refundsProcessed.toLocaleString()} accent="info" />
                <MetricDetail label="Total Payment Volume" value={`$${(aggregateMetrics.totalAmount / 100).toLocaleString()}`} accent="info" />
                <MetricDetail label="Total Refund Volume" value={`$${(aggregateMetrics.totalRefundAmount / 100).toLocaleString()}`} accent="info" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'latency' && (
        <div className="reports-tab-content">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card variant="default">
              <CardHeader>
                <CardTitle>Latency Percentiles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <LatencyPercentile label="P50 (Median)" value="118ms" color="var(--color-pulse-green)" />
                  <LatencyPercentile label="P75" value="187ms" color="var(--color-signal-teal)" />
                  <LatencyPercentile label="P95" value="342ms" color="var(--color-amber-500)" />
                  <LatencyPercentile label="P99" value="521ms" color="var(--color-coral-red)" />
                  <LatencyPercentile label="Max" value="892ms" color="color-mix(in srgb, var(--color-coral-red) 70%, transparent)" />
                </div>
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader>
                <CardTitle>Latency Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-obsidian border border-graphite rounded-card flex items-center justify-center">
                  <div className="text-center p-8">
                    <BarChart2 className="h-12 w-12 mx-auto text-ash mb-4" />
                    <p className="text-fog">Histogram chart</p>
                    <p className="text-caption text-ash mt-1">(Chart library integration pending)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'scenarios' && (
        <div className="reports-tab-content">
          <Card variant="default">
            <CardHeader>
              <CardTitle>Execution by Scenario</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(scenarioBreakdown).map(([scenarioId, data]) => (
                  <ScenarioRow key={scenarioId} scenarioId={scenarioId} data={data} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function KPICard({ icon, label, value, trend, description }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: { value: string; positive: boolean };
  description: string;
}) {
  return (
    <Card variant="default" className="kpi-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-caption text-ash uppercase tracking-wider">{label}</p>
          <p className="text-heading-lg font-w510 text-paper mt-1">{value}</p>
          <p className="text-caption text-fog mt-1">{description}</p>
        </div>
        <div className="bg-obsidian/50 border border-graphite rounded-card p-3">
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-2">
          <TrendingUp className={`h-4 w-4 ${trend.positive ? 'text-pulse-green' : 'text-coral-red'}`} />
          <span className={`text-body-sm font-w510 ${trend.positive ? 'text-pulse-green' : 'text-coral-red'}`}>
            {trend.value}
          </span>
        </div>
      )}
    </Card>
  );
}

function StatusBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-body-sm text-paper font-w500">{label}</span>
        <span className="font-berkeley-mono text-body-sm text-fog">{value.toLocaleString()} ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="h-2 bg-obsidian rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function MetricDetail({ label, value, accent = 'default' }: { label: string; value: string; accent?: 'default' | 'success' | 'warning' | 'error' | 'info' }) {
  const accentColors = {
    default: 'text-paper',
    success: 'text-pulse-green',
    warning: 'text-coral-red',
    error: 'text-coral-red',
    info: 'text-signal-teal',
  };

  return (
    <div className="bg-obsidian/50 border border-graphite rounded-card p-4">
      <p className="text-caption text-ash uppercase tracking-wider">{label}</p>
      <p className={`font-berkeley-mono text-heading-md font-w510 mt-1 ${accentColors[accent]}`}>{value}</p>
    </div>
  );
}

function LatencyPercentile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-body-sm text-paper font-w500">{label}</span>
        <span className="font-berkeley-mono text-heading-sm font-w510 text-paper">{value}</span>
      </div>
      <div className="h-2 bg-obsidian rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: '75%', backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function ScenarioRow({ scenarioId, data }: { scenarioId: string; data: { count: number; total: number; ok: number; conflicts: number } }) {
  const successRate = data.total > 0 ? ((data.ok / data.total) * 100).toFixed(1) : '0.0';
  const conflictRate = data.total > 0 ? ((data.conflicts / data.total) * 100).toFixed(1) : '0.0';

  const scenarioNames: Record<string, string> = {
    'smoke': 'Smoke Test Suite',
    'idempotency-stress': 'Idempotency Stress Test',
    'failure-injection': 'Failure Injection Suite',
    'refund-flow': 'Refund Flow Validation',
    'concurrent-race': 'Concurrent Race Condition',
    'soak-test': 'Extended Soak Test',
  };

  return (
    <div className="bg-obsidian/50 border border-graphite rounded-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-acid-lime" />
          <span className="font-w510 text-paper">{scenarioNames[scenarioId] || scenarioId}</span>
          <Badge variant="default" size="sm">{data.count} runs</Badge>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-ash">Success:</span>
            <span className="font-berkeley-mono text-pulse-green font-w510">{successRate}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-ash">Conflicts:</span>
            <span className="font-berkeley-mono text-coral-red font-w510">{conflictRate}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-ash">Total:</span>
            <span className="font-berkeley-mono text-paper font-w510">{data.total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}