import { Fragment, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[90vw]',
  };

  return createPortal(
    <Fragment>
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={contentRef}
        className={`
          fixed inset-0 z-50 flex items-center justify-center p-4
          pointer-events-none
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`
            w-full ${sizeStyles[size]} bg-carbon border border-graphite rounded-card shadow-xl
            pointer-events-auto animate-in fade-in zoom-in-95 duration-200
            max-h-[90vh] flex flex-col
          `}
        >
          <div className="flex items-start justify-between border-b border-graphite p-4 px-6">
            <div>
              <h2 className="text-subheading font-w510 tracking-subheading text-paper">{title}</h2>
              {description && (
                <p className="mt-1 text-body-sm text-fog">{description}</p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1 rounded-md text-fog hover:text-mist hover:bg-graphite transition-colors"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>
      </div>
    </Fragment>,
    document.body
  );
}