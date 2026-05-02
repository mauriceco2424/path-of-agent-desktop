/**
 * ErrorBoundary Component
 *
 * React error boundary that catches rendering errors in child components.
 * Provides user-friendly error display with retry functionality.
 *
 * Features:
 * - Catches JavaScript errors in child component tree
 * - Displays fallback UI with error message
 * - Retry button to attempt recovery
 * - Optional home navigation button
 * - Logs errors for debugging
 *
 * @module desktop/src/components/shared/ErrorBoundary
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================
// Types
// ============================================

interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Optional fallback component to render on error */
  fallback?: ReactNode;
  /** Callback when an error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to show the home button */
  showHomeButton?: boolean;
  /** Custom error message to display */
  errorMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================
// Error Fallback Component
// ============================================

interface ErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
  showHomeButton?: boolean;
  errorMessage?: string;
}

function ErrorFallback({
  error,
  onRetry,
  showHomeButton = true,
  errorMessage,
}: ErrorFallbackProps) {
  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[400px] p-8"
    >
      {/* Error Icon */}
      <div
        className={cn(
          'flex items-center justify-center w-16 h-16 mb-6 rounded-full',
          'bg-red-500/10 border border-red-500/30'
        )}
      >
        <AlertTriangle className="w-8 h-8 text-red-400" />
      </div>

      {/* Error Title */}
      <h2 className="text-xl font-semibold text-slate-100 mb-2">
        Something went wrong
      </h2>

      {/* Error Message */}
      <p className="text-sm text-slate-400 text-center max-w-md mb-6">
        {errorMessage ||
          'An unexpected error occurred. Please try again or return to the home page.'}
      </p>

      {/* Error Details (development only) */}
      {import.meta.env.DEV && error && (
        <div
          className={cn(
            'w-full max-w-lg mb-6 p-4 rounded-lg',
            'bg-slate-800/50 border border-slate-700/50',
            'overflow-auto max-h-32'
          )}
        >
          <p className="text-xs font-mono text-red-300 break-all">
            {error.message}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={onRetry}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg',
            'bg-amber-500 text-black font-medium text-sm',
            'hover:bg-amber-400 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-amber-500/50'
          )}
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>

        {showHomeButton && (
          <button
            onClick={handleGoHome}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg',
              'bg-slate-700 text-slate-200 font-medium text-sm',
              'hover:bg-slate-600 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-slate-500/50'
            )}
          >
            <Home className="w-4 h-4" />
            Go Home
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// ErrorBoundary Class Component
// ============================================

/**
 * ErrorBoundary component that catches JavaScript errors in child components.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary onError={(error) => console.error(error)}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error for debugging
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Use default error fallback
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
          showHomeButton={this.props.showHomeButton}
          errorMessage={this.props.errorMessage}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================
// Functional Error Display Component
// ============================================

interface ErrorDisplayProps {
  /** Error message to display */
  message: string;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Whether to show the home button */
  showHomeButton?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Standalone error display component for use outside ErrorBoundary.
 * Useful for displaying API errors or other async errors.
 */
export function ErrorDisplay({
  message,
  onRetry,
  showHomeButton = false,
  className,
}: ErrorDisplayProps) {
  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-col items-center justify-center p-6 rounded-xl',
        'bg-red-500/10 border border-red-500/30',
        className
      )}
    >
      {/* Error Icon */}
      <div
        className={cn(
          'flex items-center justify-center w-12 h-12 mb-4 rounded-full',
          'bg-red-500/20 border border-red-500/40'
        )}
      >
        <AlertTriangle className="w-6 h-6 text-red-400" />
      </div>

      {/* Error Message */}
      <p className="text-sm text-red-300 text-center mb-4 max-w-md">{message}</p>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg',
              'bg-red-500/20 text-red-300 text-sm',
              'hover:bg-red-500/30 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-red-500/50'
            )}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        )}

        {showHomeButton && (
          <button
            onClick={handleGoHome}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg',
              'bg-slate-700/50 text-slate-300 text-sm',
              'hover:bg-slate-700 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-slate-500/50'
            )}
          >
            <Home className="w-3.5 h-3.5" />
            Home
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default ErrorBoundary;
