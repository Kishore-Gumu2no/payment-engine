import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Rocket, Brain, CheckCircle, XCircle, AlertTriangle, RefreshCcw, Activity } from 'lucide-react';

interface ScenarioStep {
  stepId: string;
  action: 'PAYMENT' | 'REFUND';
  amount?: number;
  requestVolume: number;
  executionStrategy: 'Sequential' | 'Concurrent Attack';
}

interface LogEntry {
  id: string;
  status: number;
  message: string;
  timestamp: string;
}

export default function App() {
  const [prompt, setPrompt] = useState('I want 10 payments of Rs 150 to succeed, then an attack of Rs 50 to fail');
  const [compiledSteps, setCompiledSteps] = useState<ScenarioStep[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  
  const [isFiring, setIsFiring] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState({
    totalSent: 0,
    ok200: 0,
    conflict409: 0,
    error500: 0,
    refunds: 0
  });

  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCompile = async () => {
    setIsCompiling(true);
    try {
      const response = await fetch('https://payment-engine-37fd.vercel.app/qa/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await response.json();
      
      if (response.ok && data.rulebook) {
        setCompiledSteps(data.rulebook);
      } else {
        alert('Compilation failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error(error);
      alert('Network error. Is your backend running on port 3000?');
    }
    setIsCompiling(false);
  };

  const handleFireCannon = async () => {
    setIsFiring(true);
    setLogs([]);
    setMetrics({ totalSent: 0, ok200: 0, conflict409: 0, error500: 0, refunds: 0 });

    let activeLogs: LogEntry[] = [];
    let currentMetrics = { totalSent: 0, ok200: 0, conflict409: 0, error500: 0, refunds: 0 };

    const pushLog = (status: number, message: string) => {
      activeLogs = [...activeLogs, { id: crypto.randomUUID(), status, message, timestamp: new Date().toISOString() }];
      setLogs(activeLogs);
    };

    const updateMetrics = (status: number, action: string) => {
      currentMetrics.totalSent++;
      if (status === 200) {
        currentMetrics.ok200++;
        if (action === 'REFUND') currentMetrics.refunds++;
      }
      if (status === 409) currentMetrics.conflict409++;
      if (status >= 500) currentMetrics.error500++;
      setMetrics({ ...currentMetrics });
    };

    try {
      for (const step of compiledSteps) {
        const requests = [];
        // Determine if we share one key (attack) or make many (sequential)
        const attackKey = crypto.randomUUID(); 

        for (let i = 0; i < step.requestVolume; i++) {
          const idempotencyKey = step.executionStrategy === 'Concurrent Attack' ? attackKey : crypto.randomUUID();
          const endpoint = step.action === 'PAYMENT' ? 'https://payment-engine-37fd.vercel.app/payment' : 'https://payment-engine-37fd.vercel.app/refund';
          const body = step.action === 'PAYMENT' 
            ? { amount: step.amount || 100, idempotencyKey }
            : { originalTransactionId: 'mock_txn_123', idempotencyKey };

          const reqPromise = fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            pushLog(res.status, data.error || data.message || `Status ${res.status}`);
            updateMetrics(res.status, step.action);
          }).catch((_err) => {
            pushLog(500, 'Network/CORS Error');
            updateMetrics(500, step.action);
          });

          requests.push(reqPromise);
        }

        // Fire the batch concurrently!
        await Promise.all(requests);
      }
    } catch (error) {
      console.error(error);
    }
    
    setIsFiring(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center space-x-3 border-b border-gray-800 pb-4">
          <Activity className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold">Payment Engine powered by Stateful AI</h1>
        </div>

        {/* Zone 1: AI Prompt Compiler */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-lg">
          <div className="mb-4">
            <div className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold">1. Transaction Scenario Generator</h2>
            </div>
            {/* The new sleek remark below the header */}
            <p className="text-sm text-gray-400 mt-1 ml-7 italic">
              Instruct the underlying engine to build custom payment sequences, concurrency attacks, or failure state loops
            </p>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-32 bg-gray-950 border border-gray-700 rounded-lg p-4 text-gray-300 focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
            placeholder="Define payment amounts, expected transaction behaviors, or concurrent gateway failures.."
          />
          <button
            onClick={handleCompile}
            disabled={isCompiling || !prompt}
            className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            {isCompiling ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            <span>{isCompiling ? 'Parsing Transaction Logic...' : 'Compile Scenario '}</span>
          </button>

          {/* Compiled Steps Preview */}
          {compiledSteps.length > 0 && (
            <div className="mt-6 border-t border-gray-800 pt-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Compiled Rulebook:</h3>
              <div className="space-y-2">
                {compiledSteps.map((step, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-gray-950 p-3 rounded border border-gray-800 text-sm">
                    <span className="font-mono text-blue-400">{step.action}</span>
                    <span>Vol: <strong>{step.requestVolume}</strong></span>
                    {step.amount && <span>Amount: Rs {step.amount}</span>}
                    <span className={`px-2 py-1 rounded text-xs ${step.executionStrategy === 'Concurrent Attack' ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'}`}>
                      {step.executionStrategy}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Zone 2: Metrics Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricCard title="Total Sent" value={metrics.totalSent} icon={<Rocket className="w-5 h-5 text-blue-400" />} />
          <MetricCard title="200 OK" value={metrics.ok200} icon={<CheckCircle className="w-5 h-5 text-green-400" />} />
          <MetricCard title="409 Conflict" value={metrics.conflict409} icon={<AlertTriangle className="w-5 h-5 text-yellow-400" />} />
          <MetricCard title="500 Error" value={metrics.error500} icon={<XCircle className="w-5 h-5 text-red-400" />} />
          <MetricCard title="Refunds" value={metrics.refunds} icon={<RefreshCcw className="w-5 h-5 text-cyan-400" />} />
        </div>

        {/* Zone 3: Execution & Terminal */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-lg space-y-4">
          <div className="flex justify-between items-center">
             <div className="flex items-center space-x-2">
              <Terminal className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold">2. Gateway Transaction Stream</h2>
            </div>
            <button
              onClick={handleFireCannon}
              disabled={isFiring || compiledSteps.length === 0}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg font-bold shadow-lg shadow-red-500/20 transition-all flex items-center space-x-2"
            >
              {isFiring ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
              <span>{isFiring ? 'Cannon Firing...' : 'FIRE CANNON'}</span>
            </button>
          </div>

          <div 
            ref={terminalRef}
            className="w-full h-80 bg-black border border-gray-700 rounded-lg p-4 overflow-y-auto font-mono text-sm space-y-1"
          >
            {logs.length === 0 ? (
              <span className="text-gray-600">Awaiting execution command...</span>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex space-x-4 border-b border-gray-900 pb-1">
                  <span className="text-gray-500 shrink-0">{log.timestamp.split('T')[1].slice(0, -1)}</span>
                  <span className={`shrink-0 w-12 font-bold ${log.status === 200 ? 'text-green-400' : log.status === 409 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {log.status}
                  </span>
                  <span className="text-gray-300 truncate">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function MetricCard({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col items-center justify-center space-y-2 shadow-sm">
      <div className="flex items-center space-x-2">
        {icon}
        <span className="text-sm font-medium text-gray-400">{title}</span>
      </div>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  );
}