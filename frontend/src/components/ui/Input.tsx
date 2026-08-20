import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-caption font-w510 text-ash uppercase tracking-wider mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full bg-white/[0.02] border rounded-input px-3 py-2.5 text-body-sm font-inter text-mist
            placeholder:text-ash transition-all duration-150
            focus:border-mist focus:ring-2 focus:ring-mist/15 focus:outline-none
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-coral-red focus:border-coral-red focus:ring-coral-red/15' : 'border-white/[0.08]'}
            ${className}
          `}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 text-caption text-coral-red" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="mt-1.5 text-caption text-ash">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';