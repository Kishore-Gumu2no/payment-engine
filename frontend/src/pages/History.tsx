import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, Clock, Terminal, Search, Filter, ChevronDown, Download, X, CheckCircle, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { useHistory } from '../hooks/useHistory.js';
import { MODE } from '../config/mode.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Table,
  Modal,
  Input,
  Select,
} from '../components/ui/index.js';
import type { Column } from '../components/ui/Table.js';
import './History.css';

export function History() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    executions,
    allExecutions,
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
    refresh,
  } = useHistory();

  // Sync with URL params
  useEffect(() => {
    const execId = searchParams.get('exec');
    if (execId) {
      const exec = allExecutions.find((e) => e.id === execId);
      if (exec) setSelectedExecution(exec);
    }
  }, [searchParams, allExecutions, setSelectedExecution]);

  const handleSelectExecution = useCallback((exec: any) => {
    setSelectedExecution(exec);
    setSearchParams({ exec: exec.id }, { replace: true });
  }, [setSearchParams]);

  const handleCloseModal = useCallback(() => {
    setSelectedExecution(null);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const filteredExecutions = useMemo(() => executions, [executions]);

  const columns: Column<any>[] = useMemo(() => [
    {
      key: 'timestamp',
      header: 'Timestamp',
      className: 'font-berkeley-mono text-[12px]',
      render: (exec) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-ash" />
          {formatTimestamp(exec.timestamp)}
        </div>
      ),
    },
    {
      key: 'scenario',
      header: 'Scenario',
      render: (exec) => getScenarioName(exec.scenarioId),
    },
    {
      key: 'mode',
      header: 'Mode',
      render: () => <Badge variant="default" size="sm">DEMO</Badge>,
    },
    {
      key: 'duration',
      header: 'Duration',
      className: 'font-berkeley-mono text-[12px]',
      render: (exec) => formatDuration(exec.logs),
    },
    {
      key: 'total',
      header: 'Total',
      className: 'font-berkeley-mono text-body-sm',
      render: (exec) => exec.metrics.total,
    },
    {
      key: 'ok200',
      header: '200 OK',
      className: 'font-berkeley-mono text-body-sm text-pulse-green',
      render: (exec) => exec.metrics.ok200,
    },
    {
      key: 'conflict409',
      header: '409 Conflict',
      className: 'font-berkeley-mono text-body-sm text-coral-red',
      render: (exec) => exec.metrics.conflict409,
    },
    {
      key: 'error500',
      header: '500 Error',
      className: 'font-berkeley-mono text-body-sm text-coral-red',
      render: (exec) => exec.metrics.error500,
    },
    {
      key: 'refunds',
      header: 'Refunds',
      className: 'font-berkeley-mono text-body-sm text-signal-teal',
      render: (exec) => exec.metrics.refundsProcessed,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (exec) => (
        <Button variant="ghost" size="sm" onClick={() => handleSelectExecution(exec)} icon={<Activity className="h-4 w-4" />} aria-label="View details" />
      ),
    },
  ], [getScenarioName, formatTimestamp, formatDuration, handleSelectExecution]);

  return (
    <div className="history-page">
      <header className="page-header">
        <div className="header-left">
          <h1 className="page-title">Execution History</h1>
          <p className="page-subtitle">
            Browse and analyze past test executions
          </p>
        </div>
        <div className="header-right">
          <Button variant="ghost" onClick={refresh} loading={isLoading} icon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
        </div>
      </header>

      {MODE.isDemo && (
        <div className="demo-banner">
          <Activity className="h-4 w-4" />
          <span>Showing <strong>pre-generated demo executions</strong>. Set VITE_DEMO_MODE=false for live history.</span>
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

      <Card variant="default" className="toolbar-card">
        <CardContent className="p-0">
          <div className="toolbar">
            <div className="toolbar-left">
              <div className="search-box">
                <Search className="search-icon h-4 w-4" />
                <Input
                  type="search"
                  placeholder="Search executions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>

              <div className="filter-dropdown">
                <Filter className="h-4 w-4" />
                <Select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'demo', label: 'Demo' },
                    { value: 'live', label: 'Live' },
                  ]}
                  className="filter-select"
                />
              </div>
            </div>

            <div className="toolbar-right">
              {filteredExecutions.length > 0 && (
                <Button variant="ghost" size="sm" icon={<Download className="h-4 w-4" />}>
                  Export
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card variant="subtle" className="loading-state">
          <div className="flex items-center justify-center gap-3 py-12">
            <svg className="animate-spin h-6 w-6 text-acid-lime" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="30 100" strokeLinecap="round" />
            </svg>
            <span className="text-body-sm text-fog">Loading execution history...</span>
          </div>
        </Card>
      ) : filteredExecutions.length === 0 ? (
        <Card variant="subtle" className="empty-state-card">
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <Terminal className="h-12 w-12 text-ash" />
            <div>
              <h2 className="text-heading-sm font-w510 text-paper">No Executions Found</h2>
              <p className="text-body-sm text-fog mt-1">
                {searchQuery || filter !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'No executions recorded yet. Create a scenario and fire the cannon to get started.'}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card variant="default">
          <CardContent className="p-0">
            <Table
              columns={columns}
              data={filteredExecutions}
              keyExtractor={(exec) => exec.id}
              onRowClick={handleSelectExecution}
              hoverable
            />
          </CardContent>
        </Card>
      )}

      {/* Execution Detail Modal */}
      <Modal
        isOpen={!!selectedExecution}
        onClose={handleCloseModal}
        title="Execution Details"
        description={selectedExecution ? `${getScenarioName(selectedExecution.scenarioId)} • ${formatTimestamp(selectedExecution.timestamp)}` : undefined}
        size="lg"
      >
        {selectedExecution && (
          <ExecutionDetailContent
            execution={selectedExecution}
            scenarioName={getScenarioName(selectedExecution.scenarioId)}
          />
        )}
      </Modal>
    </div>
  );
}

function ExecutionDetailContent({ execution, scenarioName }: { execution: any; scenarioName: string }) {
  const getStatusClass = (status: number) => {
    if (status >= 200 && status < 300) return 'text-pulse-green';
    if (status === 409) return 'text-coral-red';
    if (status >= 500) return 'text-coral-red';
    return 'text-ash';
  };

  const getStatusLabel = (status: number) => {
    if (status >= 200 && status < 300) return 'OK';
    if (status === 409) return 'CONFLICT';
    if (status === 408) return 'TIMEOUT';
    if (status >= 500) return 'ERROR';
    return String(status);
  };

  return (
    <div className="space-y-8">
      {/* Overview */}
      <div className="grid gap-6 md:grid-cols-4">
        <div className="bg-obsidian border border-graphite rounded-card p-4">
          <p className="text-caption text-ash uppercase tracking-wider">Execution ID</p>
          <p className="font-berkeley-mono text-body-sm text-paper mt-1">{execution.id}</p>
        </div>
        <div className="bg-obsidian border border-graphite rounded-card p-4">
          <p className="text-caption text-ash uppercase tracking-wider">Scenario</p>
          <p className="text-body-sm text-paper mt-1">{scenarioName}</p>
        </div>
        <div className="bg-obsidian border border-graphite rounded-card p-4">
          <p className="text-caption text-ash uppercase tracking-wider">Timestamp</p>
          <p className="font-berkeley-mono text-body-sm text-paper mt-1">{new Date(execution.timestamp).toLocaleString()}</p>
        </div>
        <div className="bg-obsidian border border-graphite rounded-card p-4">
          <p className="text-caption text-ash uppercase tracking-wider">Mode</p>
          <p className="text-body-sm text-paper mt-1"><Badge variant="default" size="sm">DEMO</Badge></p>
        </div>
      </div>

      {/* Metrics */}
      <div>
        <h3 className="text-subheading font-w510 text-fog mb-4">Metrics</h3>
        <div className="grid gap-4 sm:grid-cols-5">
          <MetricInline label="Total" value={execution.metrics.total} />
          <MetricInline label="200 OK" value={execution.metrics.ok200} accent="success" />
          <MetricInline label="409 Conflict" value={execution.metrics.conflict409} accent="warning" />
          <MetricInline label="500 Error" value={execution.metrics.error500} accent="error" />
          <MetricInline label="Refunds" value={execution.metrics.refundsProcessed} accent="info" />
        </div>
      </div>

      {/* Log Entries */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-subheading font-w510 text-fog">Log Entries ({execution.logs.length})</h3>
        </div>
        <div className="bg-[#0d1117] rounded-md overflow-hidden max-h-[400px]">
          <div className="flex items-center gap-2 border-b border-graphite bg-obsidian px-4 py-2.5">
            <span className="w-3 h-3 rounded-full bg-coral-red/80" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80" />
            <span className="w-3 h-3 rounded-full bg-pulse-green/80" />
            <span className="ml-2 text-[11px] font-w500 text-ash font-berkeley-mono">qa-terminal</span>
          </div>
          <div className="p-4 font-berkeley-mono text-[12px] leading-relaxed overflow-y-auto max-h-[350px]">
            {execution.logs.map((log: any, index: number) => (
              <div key={`${log.timestamp}-${index}`} className="flex gap-3 items-start pb-1 border-b border-white/[0.02] last:border-0">
                <span className="text-ash shrink-0">[{log.timestamp}]</span>
                <span className={`shrink-0 font-w500 ${getStatusClass(log.status)}`}>
                  {getStatusLabel(log.status)}
                </span>
                <span className="text-mist truncate">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricInline({ label, value, accent = 'default' }: { label: string; value: number; accent?: 'default' | 'success' | 'warning' | 'error' | 'info' }) {
  const accentColors = {
    default: 'text-paper',
    success: 'text-pulse-green',
    warning: 'text-coral-red',
    error: 'text-coral-red',
    info: 'text-signal-teal',
  };

  return (
    <div className="bg-obsidian border border-graphite rounded-card p-4">
      <p className="text-caption text-ash uppercase tracking-wider">{label}</p>
      <p className={`font-berkeley-mono text-heading-sm font-w510 mt-1 ${accentColors[accent]}`}>{value}</p>
    </div>
  );
}