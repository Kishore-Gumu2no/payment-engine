import type { ButtonHTMLAttributes } from 'react';
import { forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-inter font-w510 tracking-body-sm transition-all duration-150 rounded-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid-lime focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:opacity-50 disabled:cursor-not-allowed';

    const variantStyles = {
      primary: 'bg-acid-lime text-void shadow-[0px_5px_2px_rgba(0,0,0,0.01),0px_3px_2px_rgba(0,0,0,0.04),0px_1px_1px_rgba(0,0,0,0.07)] hover:bg-[#d3e01f] active:bg-[#c4cf1d] active:scale-[0.98]',
      ghost: 'bg-transparent text-mist border border-graphite hover:bg-graphite hover:text-paper active:bg-smoke',
      destructive: 'bg-gradient-to-r from-coral-red to-[#e04545] text-paper shadow-[0_4px_24px_rgba(235,87,87,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] hover:from-[#d64a4a] hover:to-[#e04545] hover:shadow-[0_8px_32px_rgba(235,87,87,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] active:scale-[0.98]',
      outline: 'bg-transparent text-mist border border-graphite hover:bg-graphite hover:text-paper',
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-caption gap-2',
      md: 'px-4 py-2 text-body-sm gap-2',
      lg: 'px-6 py-3 text-body gap-3',
      xl: 'px-8 py-4 text-subheading gap-3',
    };

    const widthStyles = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              strokeDasharray="30 100"
              strokeLinecap="round"
            />
          </svg>
        ) : iconPosition === 'left' && icon ? (
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
        {children}
        {iconPosition === 'right' && icon && !loading ? (
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
      </button>
    );
  }
);

Button.displayName = 'Button';