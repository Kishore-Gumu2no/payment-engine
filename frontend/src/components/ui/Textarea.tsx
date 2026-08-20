import type { TextareaHTMLAttributes } from 'react';
import { forwardRef } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-caption font-w510 text-ash uppercase tracking-wider mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            w-full bg-white/[0.02] border rounded-input px-3 py-2.5 text-body-sm font-inter text-mist
            placeholder:text-ash transition-all duration-150 resize-y min-h-[100px]
            focus:border-mist focus:ring-2 focus:ring-mist/15 focus:outline-none
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-coral-red focus:border-coral-red focus:ring-coral-red/15' : 'border-white/[0.08]'}
            ${className}
          `}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${textareaId}-error`} className="mt-1.5 text-caption text-coral-red" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${textareaId}-hint`} className="mt-1.5 text-caption text-ash">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';