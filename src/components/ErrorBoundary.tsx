import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './ui'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Quando qualquer valor muda (ex.: a rota), o fallback é descartado e a página tenta renderizar de novo. */
  resetKeys?: readonly unknown[]
}

interface ErrorBoundaryState {
  hasError: boolean
}

const keysChanged = (a: readonly unknown[] = [], b: readonly unknown[] = []) =>
  a.length !== b.length || a.some((item, index) => !Object.is(item, b[index]))

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro de renderização:', error, info.componentStack)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && keysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="app-feedback error" role="alert">
        <div>
          <h1>Algo deu errado</h1>
          <p>Não foi possível exibir esta página. Tente novamente ou volte ao início.</p>
          <div className="feedback-actions">
            <Button onClick={() => this.setState({ hasError: false })}>Tentar novamente</Button>
            {/* <a> comum de propósito: recarrega o app caso o roteador também tenha quebrado */}
            <a className="button secondary" href="/">
              Voltar ao início
            </a>
          </div>
        </div>
      </div>
    )
  }
}
