import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to console for debugging
    // eslint-disable-next-line no-console
    console.error('Error caught by ErrorBoundary:', error, errorInfo);

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // You could also log the error to an error reporting service here
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Oops! Something went wrong
              </h1>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              An unexpected error occurred in the application. You can try refreshing the page or
              going back to the previous screen.
            </p>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-red-900 dark:text-red-300 mb-2">Error Details:</h3>
              <p className="text-red-800 dark:text-red-400 text-sm font-mono break-words">
                {this.state.error && this.state.error.toString()}
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mb-6">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                  Stack Trace (Development Only)
                </summary>
                <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto max-h-64 text-gray-800 dark:text-gray-300">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-4">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
