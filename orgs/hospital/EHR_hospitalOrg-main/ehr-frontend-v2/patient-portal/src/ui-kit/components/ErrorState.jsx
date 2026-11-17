import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ErrorState({
  title = 'Unable to load data',
  message = 'An error occurred while communicating with the ledger service.',
  onRetry,
  className = ''
}) {
  return (
    <div className={`p-6 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 text-center ${className}`}>
      <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3">
        <AlertTriangle size={20} />
      </div>
      <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">{title}</h4>
      <p className="text-xs text-red-700 dark:text-red-300 max-w-md mx-auto mb-4">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors"
        >
          <RefreshCw size={12} />
          <span>Retry Request</span>
        </button>
      )}
    </div>
  )
}
