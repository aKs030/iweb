/**
 * React Error Boundary Component
 * @version 1.0.0
 * @description Catches React rendering errors and provides fallback UI
 */

import React from 'https://esm.sh/react@19.2.3?dev=false';
import { handleRenderError, ErrorSeverity } from '../utils/error-handler.js';
import { createLogger } from '../utils/shared-utilities.js';

const log = createLogger('ErrorBoundary');

/**
 * Error Boundary Component
 * Catches errors in child components and displays fallback UI
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    const { component = 'Unknown', onError } = this.props;

    // Log error with context
    handleRenderError(error, {
      component,
      action: 'Component Render',
      severity: ErrorSeverity.HIGH,
      metadata: {
        componentStack: errorInfo.componentStack,
        errorBoundary: this.constructor.name,
      },
    });

    // Update state with error details
    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Call custom error handler if provided
    if (typeof onError === 'function') {
      try {
        onError(error, errorInfo);
      } catch (err) {
        log.warn('Custom error handler failed:', err);
      }
    }
  }

  handleReset = () => {
    const { onReset } = this.props;

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (typeof onReset === 'function') {
      onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error, errorCount } = this.state;
    const {
      children,
      fallback,
      fallbackComponent: FallbackComponent,
      showDetails = false,
    } = this.props;

    if (!hasError) {
      return children;
    }

    // Use custom fallback if provided
    if (fallback) {
      return fallback;
    }

    // Use custom fallback component if provided
    if (FallbackComponent) {
      return (
        <FallbackComponent
          error={error}
          errorCount={errorCount}
          onReset={this.handleReset}
          onReload={this.handleReload}
        />
      );
    }

    // Default fallback UI
    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary__content">
          <div className="error-boundary__icon" aria-hidden="true">
            ⚠️
          </div>
          <h2 className="error-boundary__title">Etwas ist schiefgelaufen</h2>
          <p className="error-boundary__message">
            Ein Fehler ist aufgetreten. Bitte versuche es erneut.
          </p>

          {showDetails && error && (
            <details className="error-boundary__details">
              <summary>Fehlerdetails</summary>
              <pre className="error-boundary__stack">
                {error.toString()}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}

          <div className="error-boundary__actions">
            <button
              type="button"
              className="error-boundary__button error-boundary__button--primary"
              onClick={this.handleReset}
            >
              Erneut versuchen
            </button>
            <button
              type="button"
              className="error-boundary__button error-boundary__button--secondary"
              onClick={this.handleReload}
            >
              Seite neu laden
            </button>
          </div>

          {errorCount > 1 && (
            <p className="error-boundary__warning">
              Dieser Fehler ist {errorCount} Mal aufgetreten.
            </p>
          )}
        </div>
      </div>
    );
  }
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary(Component, errorBoundaryProps = {}) {
  const WrappedComponent = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}

/**
 * Hook for error boundary (React 18+)
 * Note: This is a simplified version, real implementation would need React 18+ features
 */
export function useErrorHandler() {
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return setError;
}

export default ErrorBoundary;
