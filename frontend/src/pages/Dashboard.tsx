import { Link } from 'react-router-dom';
import { Activity, PlusSquare, TerminalSquare, TrendingUp, AlertTriangle, Zap, History, FileText, Settings } from 'lucide-react';
import { MODE } from '../config/mode.js';
import { useHistory } from '../hooks/useHistory.js';
import {
  Card,
  CardContent,
  MetricCard,
  Button,
  Badge,
} from '../components/ui/index.js';
import './Dashboard.css';

export function Dashboard() {
  const { executions: recentExecutions, scenarios, isLoading } = useHistory();

  const stats = useMemo(() => {
    if (!recentExecutions.length) return null;
    const latest = recentExecutions[0];
    return {
      totalRuns: recentExecutions.length,
      totalRequests: recentExecutions.reduce((sum, e) => sum + e.metrics.total, 0),
      successRate: recentExecutions.reduce((sum, e) => sum + (e.metrics.total > 0 ? e.metrics.ok200 / e.metrics.total : 0), 0) / recentExecutions.length * 100,
      lastRun: latest.timestamp,
    };
  }, [recentExecutions]);

  const quickActions = [
    {
      href: '/builder',
      icon: PlusSquare,
      title: 'Build Scenario',
      description: 'Create test scenarios using AI prompt or manual step builder',
      primary: true,
    },
    {
      href: '/execute',
      icon: Zap,
      title: 'Execute Tests',
      description: 'Fire concurrent payment/refund requests with idempotency strategies',
      primary: false,
    },
    {
      href: '/history',
      icon: History,
      title: 'View History',
      description: 'Browse past executions, compare results, analyze patterns',
      primary: false,
    },
    {
      href: '/reports',
      icon: FileText,
      title: 'Reports',
      description: 'Detailed metrics, latency distributions, idempotency analysis',
      primary: false,
    },
  ];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {MODE.isDemo
              ? 'Viewing pre-generated demo data. Set VITE_DEMO_MODE=false to connect a backend.'
              : 'Build scenarios, execute tests, and analyze idempotency behavior.'}
          </p>
        </div>
        <div className="header-right">
          <Link to="/builder">
            <Button icon={<PlusSquare className="h-5 w-5" />}>
              New Scenario
            </Button>
          </Link>
        </div>
      </header>

      {MODE.isDemo && (
        <div className="demo-banner">
          <Activity className="h-4 w-4" />
          <span>Running in <strong>DEMO MODE</strong> — showing pre-generated QA scenarios and executions</span>
        </div>
      )}

      {/* Stats Overview */}
      <section className="stats-section" aria-label="Key metrics">
        <div className="stats-grid">
          <MetricCard
            label="Total Executions"
            value={stats?.totalRuns ?? '—'}
            icon={<Activity className="h-5 w-5 text-sky-400" />}
          />
          <MetricCard
            label="Total Requests"
            value={stats?.totalRequests ?? '—'}
            icon={<Zap className="h-5 w-5 text-emerald-400" />}
            accent="success"
          />
          <MetricCard
            label="Avg Success Rate"
            value={stats ? `${stats.successRate.toFixed(1)}%` : '—'}
            icon={<TrendingUp className="h-5 w-5 text-amber-400" />}
            accent="warning"
          />
          <MetricCard
            label="Scenarios"
            value={scenarios.length}
            icon={<FileText className="h-5 w-5 text-violet-400" />}
            accent="info"
          />
        </div>
      </section>

      {/* Quick Actions */}
      <section className="actions-section" aria-label="Quick actions">
        <h2 className="section-title">Quick Actions</h2>
        <div className="actions-grid">
          {quickActions.map((action) => (
            <Link key={action.href} to={action.href} className="action-card">
              <div className="action-icon">
                <action.icon size={28} />
              </div>
              <h3 className="action-title">{action.title}</h3>
              <p className="action-description">{action.description}</p>
              {action.primary && <span className="action-primary-indicator" />}
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section className="activity-section" aria-label="Recent executions">
        <div className="section-header">
          <h2 className="section-title">Recent Executions</h2>
          <Link to="/history" className="btn-ghost-sm">
            View All
          </Link>
        </div>

        {isLoading ? (
          <Card variant="subtle" className="activity-loading">
            <div className="flex items-center justify-center gap-3 py-8">
              <svg className="animate-spin h-6 w-6 text-acid-lime" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="30 100" strokeLinecap="round" />
              </svg>
              <span className="text-body-sm text-fog">Loading recent executions...</span>
            </div>
          </Card>
        ) : recentExecutions.length === 0 ? (
          <Card variant="subtle" className="activity-empty">
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <TerminalSquare className="h-12 w-12 text-ash" />
              <div>
                <h3 className="text-body font-w510 text-paper">No executions yet</h3>
                <p className="text-body-sm text-fog mt-1">
                  {MODE.isDemo
                    ? 'Demo executions will appear here. Visit History to see pre-generated runs.'
                    : 'Create a scenario and fire the cannon to get started.'}
                </p>
              </div>
              <Link to={MODE.isDemo ? '/history' : '/builder'}>
                <Button size="sm" variant={MODE.isDemo ? 'ghost' : 'primary'}>
                  {MODE.isDemo ? 'Browse Demo History' : 'Create First Scenario'}
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <Card variant="default">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-graphite">
                    <th className="px-4 py-3 text-left text-caption font-w510 text-ash uppercase tracking-wider">Time</th>
                    <th className="px-4 py-3 text-left text-caption font-w510 text-ash uppercase tracking-wider">Scenario</th>
                    <th className="px-4 py-3 text-left text-caption font-w510 text-ash uppercase tracking-wider">Mode</th>
                    <th className="px-4 py-3 text-left text-caption font-w510 text-ash uppercase tracking-wider">Duration</th>
                    <th className="px-4 py-3 text-left text-caption font-w510 text-ash uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-left text-caption font-w510 text-ash uppercase tracking-wider">200 OK</th>
                    <th className="px-4 py-3 text-left text-caption font-w510 text-ash uppercase tracking-wider">409</th>
                    <th className="px-4 py-3 text-left text-caption font-w510 text-ash uppercase tracking-wider">500</th>
                    <th className="px-4 py-3 text-left text-caption font-w510 text-ash uppercase tracking-wider">Refunds</th>
                    <th className="px-4 py-3 text-left text-caption font-w510 text-ash uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody>
                  {recentExecutions.slice(0, 5).map((exec) => {
                    const scenario = scenarios.find((s) => s.id === exec.scenarioId);
                    return (
                      <tr key={exec.id} className="border-b border-graphite/50 hover:bg-graphite/50 cursor-pointer" onClick={() => window.location.href = `/history?exec=${exec.id}`}>
                        <td className="px-4 py-3 font-berkeley-mono text-[12px] text-fog">{new Date(exec.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-3 text-body-sm text-paper truncate max-w-[200px]">{scenario?.name || 'Unknown'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="default" size="sm">DEMO</Badge>
                        </td>
                        <td className="px-4 py-3 font-berkeley-mono text-[12px] text-fog">
                          {exec.logs.length >= 2
                            ? `${new Date(exec.logs[exec.logs.length - 1].timestamp).getTime() - new Date(exec.logs[0].timestamp).getTime()}ms`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 font-berkeley-mono text-body-sm text-mist">{exec.metrics.total}</td>
                        <td className="px-4 py-3 font-berkeley-mono text-body-sm text-pulse-green">{exec.metrics.ok200}</td>
                        <td className="px-4 py-3 font-berkeley-mono text-body-sm text-coral-red">{exec.metrics.conflict409}</td>
                        <td className="px-4 py-3 font-berkeley-mono text-body-sm text-coral-red">{exec.metrics.error500}</td>
                        <td className="px-4 py-3 font-berkeley-mono text-body-sm text-signal-teal">{exec.metrics.refundsProcessed}</td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Activity className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}

import { useMemo } from 'react';