import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ padding: 48, fontFamily: 'system-ui, sans-serif' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: '#66747d', marginBottom: 16 }}>
            An unexpected error occurred while rendering the application.
          </p>
          <pre
            style={{
              background: '#f4eee7',
              padding: 16,
              borderRadius: 8,
              fontSize: 13,
              overflow: 'auto',
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 16,
              padding: '8px 20px',
              borderRadius: 6,
              border: 'none',
              background: '#16212a',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      )
    }

    return this.props.children
  }
}
