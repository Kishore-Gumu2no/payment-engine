import type { HTMLAttributes, ForwardedRef } from 'react';
import { forwardRef, useImperativeHandle, useRef } from 'react';

export interface LogEntry {
  id: string;
  status: number;
  message: string;
  timestamp: string;
  action?: 'PAYMENT' | 'REFUND';
}

export interface TerminalRef {
  scrollToBottom: () => void;
  scrollToTop: () => void;
}

export interface TerminalProps extends HTMLAttributes<HTMLDivElement> {
  logs: LogEntry[];
  autoScroll?: boolean;
  maxHeight?: string;
  showTimestamp?: boolean;
  showStatus?: boolean;
}

export const Terminal = forwardRef<TerminalRef, TerminalProps>(
  ({ logs, autoScroll = true, maxHeight = '400px', showTimestamp = true, showStatus = true, className = '', ...props }, ref) => {
    const terminalRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      scrollToBottom: () => {
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      },
      scrollToTop: () => {
        if (terminalRef.current) {
          terminalRef.current.scrollTop = 0;
        }
      },
    }));

    const getStatusClass = (status: number) => {
      if (status >= 200 && status < 300) return 'text-pulse-green';
      if (status === 409) return 'text-coral-red';
      if (status === 408) return 'text-signal-teal';
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
      <div
        ref={terminalRef}
        className={`
          font-berkeley-mono text-[12px] leading-relaxed bg-[#0d1117] rounded-md overflow-y-auto
          ${maxHeight ? `max-h-[${maxHeight}]` : ''}
          ${className}
        `}
        role="log"
        aria-live="polite"
        aria-label="Execution terminal"
        {...props}
      >
        <div className="flex items-center gap-2 border-b border-graphite bg-obsidian px-4 py-2.5">
          <span className="w-3 h-3 rounded-full bg-coral-red/80" />
          <span className="w-3 h-3 rounded-full bg-amber-500/80" />
          <span className="w-3 h-3 rounded-full bg-pulse-green/80" />
          <span className="ml-2 text-[11px] font-w510 text-ash">qa-terminal</span>
        </div>
        <div className="p-4">
          {logs.length === 0 ? (
            <p className="text-ash text-center py-8">// Waiting for execution… responses will stream here.</p>
          ) : (
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div
                  key={`${log.timestamp}-${index}`}
                  className="flex gap-3 items-start pb-1 border-b border-white/[0.02] last:border-0"
                >
                  {showTimestamp && (
                    <span className="text-ash shrink-0 font-mono text-[11px]">
                      [{log.timestamp}]
                    </span>
                  )}
                  {showStatus && (
                    <span
                      className={`shrink-0 font-w500 font-mono text-[11px] ${getStatusClass(log.status)}`}
                    >
                      {getStatusLabel(log.status)}
                    </span>
                  )}
                  <span className="text-mist truncate font-mono">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);

Terminal.displayName = 'Terminal';