import { useState, useEffect, useCallback } from 'react';
import { Server, Database, Save, CheckCircle, AlertCircle, Info, Keyboard, Command, HelpCircle } from 'lucide-react';
import { MODE } from '../config/mode.js';
import { apiClient } from '../services/apiClient.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Input,
  Modal,
} from '../components/ui/index.js';
import './Settings.css';

export function Settings() {
  const [apiBase, setApiBase] = useState(MODE.apiBase);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // G + D/B/E/H/R/S navigation
      if (e.key === 'g' || e.key === 'G') {
        const handleSecondKey = (e2: KeyboardEvent) => {
          e2.preventDefault();
          const routes: Record<string, string> = {
            d: '/',
            b: '/builder',
            e: '/execute',
            h: '/history',
            r: '/reports',
            s: '/settings',
          };
          const route = routes[e2.key.toLowerCase()];
          if (route) {
            window.location.href = route;
          }
          document.removeEventListener('keydown', handleSecondKey);
        };
        document.addEventListener('keydown', handleSecondKey, { once: true });
        return;
      }

      // Ctrl+K for command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }

      // ? for help
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (!target.closest('input, textarea, [contenteditable]')) {
          e.preventDefault();
          setShowHelpModal(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTestConnection = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);
    setTestMessage('Testing connection...');

    try {
      const result = await apiClient.healthCheck();

      if (result.status === 'ok' || result.status === 'demo-mode') {
        setTestResult('success');
        setTestMessage('Backend connection successful!');
      } else {
        setTestResult('error');
        setTestMessage(`Backend responded with status: ${result.status}`);
      }
    } catch (error) {
      setTestResult('error');
      setTestMessage(
        error instanceof TypeError
          ? 'Network error — is the backend running? Check CORS settings.'
          : error instanceof Error
          ? error.message
          : 'Connection failed'
      );
    } finally {
      setIsTesting(false);
    }
  }, [apiBase]);

  const handleSaveSettings = useCallback(() => {
    localStorage.setItem('apiBase', apiBase);
    setTestResult('success');
    setTestMessage('Settings saved to local storage');
    setTimeout(() => setTestResult(null), 3000);
  }, [apiBase]);

  const shortcuts = [
    { keys: ['G', 'D'], action: 'Go to Dashboard' },
    { keys: ['G', 'B'], action: 'Go to Scenario Builder' },
    { keys: ['G', 'E'], action: 'Go to Execute' },
    { keys: ['G', 'H'], action: 'Go to History' },
    { keys: ['G', 'R'], action: 'Go to Reports' },
    { keys: ['G', 'S'], action: 'Go to Settings' },
    { keys: ['Ctrl', 'K'], action: 'Open Command Palette' },
    { keys: ['?'], action: 'Show Help' },
  ];

  const commandPaletteItems = [
    { keys: 'G D', label: 'Go to Dashboard', route: '/' },
    { keys: 'G B', label: 'Go to Scenario Builder', route: '/builder' },
    { keys: 'G E', label: 'Go to Execute', route: '/execute' },
    { keys: 'G H', label: 'Go to History', route: '/history' },
    { keys: 'G R', label: 'Go to Reports', route: '/reports' },
    { keys: 'G S', label: 'Go to Settings', route: '/settings' },
    { keys: '?', label: 'Show Help', action: () => { setShowCommandPalette(false); setShowHelpModal(true); } },
  ];

  return (
    <div className="settings-page">
      <header className="page-header">
        <div className="header-left">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Configure application behavior, backend connection, and display preferences
          </p>
        </div>
        <div className="header-right">
          <Button variant="ghost" size="sm" onClick={() => setShowHelpModal(true)} icon={<HelpCircle className="h-4 w-4" />}>
            Help
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowCommandPalette(true)} icon={<Command className="h-4 w-4" />}>
            Command Palette
          </Button>
        </div>
      </header>

      {MODE.isDemo && (
        <div className="demo-banner">
          <Info className="h-4 w-4" />
          <span>
            Running in <strong>DEMO MODE</strong> — backend connection settings are disabled.
            Set <code>VITE_DEMO_MODE=false</code> to enable live mode.
          </span>
        </div>
      )}

      <section className="settings-section">
        <h2 className="section-title">
          <Server className="section-icon" size={20} />
          Backend Connection
        </h2>

        <Card variant="default" className="settings-card">
          <CardContent className="space-y-6">
            <div className="setting-item">
              <div className="setting-info">
                <h3 className="setting-label">API Base URL</h3>
                <p className="setting-description">
                  The base URL for the payment engine backend API.
                  Default: <code>http://localhost:3000</code>
                </p>
              </div>
              <div className="setting-control">
                <Input
                  type="url"
                  value={apiBase}
                  onChange={(e) => setApiBase(e.target.value)}
                  placeholder="http://localhost:3000"
                  disabled={MODE.isDemo}
                  className="setting-input"
                />
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <h3 className="setting-label">Connection Test</h3>
                <p className="setting-description">
                  Verify that the backend is reachable and responding correctly.
                </p>
              </div>
              <div className="setting-control">
                <Button
                  variant="ghost"
                  onClick={handleTestConnection}
                  disabled={isTesting || MODE.isDemo}
                  icon={isTesting ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="30 100" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                >
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Button>

                {testResult && (
                  <div className={`connection-result ${testResult}`}>
                    {testResult === 'success' ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        <span>{testMessage}</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4" />
                        <span>{testMessage}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!MODE.isDemo && (
              <div className="setting-item setting-item--save">
                <div className="setting-info" />
                <div className="setting-control">
                  <Button variant="primary" onClick={handleSaveSettings} icon={<Save className="h-4 w-4" />}>
                    Save Settings
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="settings-section">
        <h2 className="section-title">
          <Info className="section-icon" size={20} />
          Application Info
        </h2>

        <Card variant="default" className="settings-card">
          <CardContent>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Mode</span>
                <Badge variant={MODE.isDemo ? 'success' : 'default'} size="md">
                  {MODE.isDemo ? 'DEMO' : 'LIVE'}
                </Badge>
              </div>
              <div className="info-item">
                <span className="info-label">Demo Data Path</span>
                <span className="info-value font-berkeley-mono text-body-sm">{MODE.demoDataPath}</span>
              </div>
              <div className="info-item">
                <span className="info-label">API Base (Effective)</span>
                <span className="info-value font-berkeley-mono text-body-sm">{MODE.apiBase}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Environment</span>
                <span className="info-value">
                  {import.meta.env.MODE === 'development' ? 'Development' : 'Production'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="settings-section">
        <h2 className="section-title">
          <Info className="section-icon" size={20} />
          Environment Variables
        </h2>

        <Card variant="default" className="settings-card">
          <CardContent>
            <p className="env-note">
              The following environment variables control application behavior.
              Set them in your <code>.env</code> file or deployment platform.
            </p>

            <table className="env-table">
              <thead>
                <tr>
                  <th scope="col">Variable</th>
                  <th scope="col">Current Value</th>
                  <th scope="col">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-berkeley-mono text-body-sm">VITE_DEMO_MODE</td>
                  <td className="font-berkeley-mono text-body-sm">{import.meta.env.VITE_DEMO_MODE || 'false'}</td>
                  <td>Enable demo mode (no backend required)</td>
                </tr>
                <tr>
                  <td className="font-berkeley-mono text-body-sm">VITE_API_BASE</td>
                  <td className="font-berkeley-mono text-body-sm">{import.meta.env.VITE_API_BASE || 'http://localhost:3000'}</td>
                  <td>Backend API base URL</td>
                </tr>
                <tr>
                  <td className="font-berkeley-mono text-body-sm">VITE_DEMO_DATA_PATH</td>
                  <td className="font-berkeley-mono text-body-sm">{import.meta.env.VITE_DEMO_DATA_PATH || '/data/demo.json'}</td>
                  <td>Path to demo data JSON file</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section className="settings-section">
        <h2 className="section-title">
          <Keyboard className="section-icon" size={20} />
          Keyboard Shortcuts
        </h2>

        <Card variant="default" className="settings-card">
          <CardContent>
            <table className="shortcuts-table">
              <thead>
                <tr>
                  <th scope="col">Shortcut</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {shortcuts.map((shortcut, index) => (
                  <tr key={index}>
                    <td>
                      <div className="kbd-group">
                        {shortcut.keys.map((key, i) => (
                          <kbd key={i} className="kbd">{key}</kbd>
                        ))}
                      </div>
                    </td>
                    <td>{shortcut.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {/* Help Modal */}
      <Modal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title="Keyboard Shortcuts & Help"
        size="md"
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-subheading font-w510 text-fog mb-3">Navigation Shortcuts</h3>
            <table className="shortcuts-table">
              <thead>
                <tr>
                  <th scope="col">Shortcut</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {shortcuts.slice(0, 6).map((shortcut, index) => (
                  <tr key={index}>
                    <td>
                      <div className="kbd-group">
                        {shortcut.keys.map((key, i) => (
                          <kbd key={i} className="kbd">{key}</kbd>
                        ))}
                      </div>
                    </td>
                    <td>{shortcut.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-graphite pt-6">
            <h3 className="text-subheading font-w510 text-fog mb-3">Global Shortcuts</h3>
            <table className="shortcuts-table">
              <thead>
                <tr>
                  <th scope="col">Shortcut</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {shortcuts.slice(6).map((shortcut, index) => (
                  <tr key={index}>
                    <td>
                      <div className="kbd-group">
                        {shortcut.keys.map((key, i) => (
                          <kbd key={i} className="kbd">{key}</kbd>
                        ))}
                      </div>
                    </td>
                    <td>{shortcut.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-graphite pt-6">
            <h3 className="text-subheading font-w510 text-fog mb-3">Quick Reference</h3>
            <div className="space-y-2 text-body-sm text-mist">
              <p><strong>G</strong> + <strong>Letter</strong> — Press G then the letter (D, B, E, H, R, S) for navigation</p>
              <p><strong>Ctrl/Cmd</strong> + <strong>K</strong> — Open command palette for quick actions</p>
              <p><strong>?</strong> — Show this help modal (when not in input fields)</p>
              <p className="text-caption text-ash mt-4">Shortcuts are disabled while typing in input fields or textareas.</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Command Palette Modal */}
      <Modal
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        title="Command Palette"
        size="md"
      >
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {commandPaletteItems.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                if (item.route) {
                  window.location.href = item.route;
                }
                if (item.action) {
                  item.action();
                }
                setShowCommandPalette(false);
              }}
              className="command-palette-item flex items-center justify-between w-full p-3 text-left bg-obsidian/50 border border-graphite rounded-btn hover:border-acid-lime/50 transition-colors"
            >
              <span className="text-paper font-w500">{item.label}</span>
              <span className="font-berkeley-mono text-caption text-ash">{item.keys}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}