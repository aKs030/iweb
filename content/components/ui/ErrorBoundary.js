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
      console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    render() {
      if (this.state.hasError) {
        if (this.props.fallback) {
          return this.props.fallback;
        }

        return ReactInstance.createElement(
          'div',
          {
            style: {
              padding: '2rem',
              textAlign: 'center',
              color: '#ccc',
              background: 'rgba(0,0,0,0.5)',
              borderRadius: '12px',
              margin: '2rem auto',
              maxWidth: '600px',
            },
          },
          ReactInstance.createElement(
            'h2',
            { style: { color: '#ff6b6b', marginBottom: '1rem' } },
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
              style: {
                marginTop: '1rem',
                padding: '0.5rem 1.5rem',
                background: '#0077ff',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '1rem',
              },
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
