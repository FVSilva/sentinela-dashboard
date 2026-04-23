import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[Sentinela] Erro capturado pelo ErrorBoundary:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 p-6" style={{ background: '#080808' }}>
          <AlertTriangle className="w-10 h-10 text-red-500" />
          <p className="text-white font-semibold text-lg">Algo deu errado</p>
          <p className="text-gray-500 text-xs font-mono bg-white/5 p-3 rounded-lg max-w-sm text-center break-words">
            {this.state.error?.message || 'Erro inesperado'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-700 hover:bg-red-600 text-white text-sm rounded-xl font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
