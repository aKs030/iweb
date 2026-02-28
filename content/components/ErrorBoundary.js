/**
 * React Error Boundary Component
 * Catches rendering errors and shows a fallback UI
 * @version 1.0.0
 */

/**
 * Create an Error Boundary class for the given React instance
 * @param {typeof import('react')} ReactInstance - The React instance to use
 * @returns {typeof import('react').Component} ErrorBoundary component class
 */
export function createErrorBoundary(ReactInstance) {
  class ErrorBoundary extends ReactInstance.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
      // Log error details — use dynamic import so the bundle stays small
      // and this module has zero hard dependencies on the logger.
      import('/content/core/logger.js')
        .then(({ createLogger }) => {
          const log = createLogger('ErrorBoundary');
          log.error('Caught error:', error, errorInfo);
        })
        .catch(() => {
          // Fallback if logger fails to load
          /* eslint-disable-next-line no-console */
          console.error('[ErrorBoundary] Caught error:', error, errorInfo);
        });
    }

    render() {
      if (this.state.hasError) {
        if (this.props.fallback) {
          return this.props.fallback;
        }

        return ReactInstance.createElement(
          'div',
          {
            className: 'error-boundary-fallback',
          },
          ReactInstance.createElement(
            'h2',
            { className: 'error-boundary-fallback__title' },
            'Etwas ist schiefgelaufen',
          ),
          ReactInstance.createElement(
            'p',
            null,
            'Die Anwendung konnte nicht geladen werden. Bitte versuchen Sie, die Seite neu zu laden.',
          ),
          ReactInstance.createElement(
            'button',
            {
              onClick: () => window.location.reload(),
              className: 'error-boundary-fallback__action',
            },
            'Seite neu laden',
          ),
        );
      }

      return this.props.children;
    }
  }

  return ErrorBoundary;
}
