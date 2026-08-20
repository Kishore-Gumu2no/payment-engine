import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface MetricCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: number | string;
  icon?: React.ReactElement<LucideIcon>;
  accent?: 'default' | 'success' | 'warning' | 'error' | 'info';
  trend?: { value: number; label: string };
}

export const MetricCard = forwardRef<HTMLDivElement, MetricCardProps>(
  ({ label, value, icon, accent = 'default', trend, className = '', children, ...props }, ref) => {
    const accentColors = {
      default: 'text-paper',
      success: 'text-pulse-green',
      warning: 'text-coral-red',
      error: 'text-coral-red',
      info: 'text-signal-teal',
    };

    return (
      <div
        ref={ref}
        className={`
          bg-carbon border border-graphite rounded-card p-6
          flex flex-col items-start gap-3
          ${className}
        `}
        {...props}
      >
        <div className="flex items-center gap-2 text-caption text-fog">
          {icon && <span className="text-fog">{icon}</span>}
          <span>{label}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-heading-sm font-w510 tracking-heading-sm font-berkeley-mono ${accentColors[accent]}`}>
            {value}
          </span>
          {trend && (
            <span className={`text-caption font-w500 ${trend.value >= 0 ? 'text-pulse-green' : 'text-coral-red'}`}>
              {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value)}% {trend.label}
            </span>
          )}
        </div>
        {children}
      </div>
    );
  }
);

MetricCard.displayName = 'MetricCard';