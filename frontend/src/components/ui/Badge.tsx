import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'payment'
  | 'refund';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'md', className = '', children, ...props }, ref) => {
    const variantStyles = {
      default: 'bg-white/[0.05] text-fog',
      success: 'bg-pulse-green/15 text-pulse-green border border-pulse-green/30',
      warning: 'bg-coral-red/15 text-coral-red border border-coral-red/30',
      error: 'bg-coral-red/20 text-coral-red border border-coral-red/40',
      info: 'bg-signal-teal/15 text-signal-teal border border-signal-teal/30',
      payment: 'bg-iris-violet/20 text-iris-violet border border-iris-violet/30',
      refund: 'bg-lavender/20 text-lavender border border-lavender/30',
    };

    const sizeStyles = {
      sm: 'px-2 py-0.5 text-[11px]',
      md: 'px-2.5 py-1 text-caption',
    };

    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center font-inter font-normal rounded-badge
          ${variantStyles[variant]} ${sizeStyles[size]} ${className}
        `}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';