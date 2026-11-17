import React, { useState } from 'react'
import { fetchApi } from '../services/api'
import { Bell, BellOff, CheckCircle2, ShieldAlert } from 'lucide-react'

export default function Alerts() {
  const { data, error, loading, reload } = useAlertsData()

  return (
    <section className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Active Alerts</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Threshold-based alerts raised by the dashboard alert engine. Alerts resolve automatically when conditions clear.</p>
      </header>

      {loading && <p className="premium-card p-6 text-slate-500 dark:text-slate-400 text-sm">Loading telemetry alerts…</p>}
      {error && <p role="alert" className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-amber-900 dark:text-amber-200 text-sm">{error}</p>}

      {data && (
        data.items?.length ? (
          <ul className="space-y-3">
            {data.items.map(alert => (
              <AlertRow key={alert.id} alert={alert} onAcknowledge={reload} />
            ))}
          </ul>
        ) : (
          <div className="premium-card p-10 text-center border-emerald-200/60 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/30 dark:from-emerald-950/20 dark:via-slate-900/40 dark:to-teal-950/20">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-100/80 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
              <CheckCircle2 size={30} />
            </div>
            <p className="font-bold text-lg text-emerald-900 dark:text-emerald-300">All Systems Normal — No Active Alerts</p>
            <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80 mt-1 max-w-md mx-auto">The automated anomaly & threshold engine is actively monitoring Fabric peer latency, consensus rounds, and zero-PHI compliance.</p>
          </div>
        )
      )}
    </section>
  )
}

function AlertRow({ alert, onAcknowledge }) {
  const [busy, setBusy] = useState(false)
  const severityStyle = {
    CRITICAL: 'border-red-300/80 bg-red-50/60 dark:bg-red-950/30 dark:border-red-900/60',
    HIGH: 'border-orange-300/80 bg-orange-50/60 dark:bg-orange-950/30 dark:border-orange-900/60',
    WARNING: 'border-amber-300/80 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-900/60',
    INFO: 'border-blue-200/80 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-900/60',
  }[alert.severity] || 'border-slate-200 dark:border-slate-800'
  const severityText = {
    CRITICAL: 'text-red-700 dark:text-red-400',
    HIGH: 'text-orange-700 dark:text-orange-400',
    WARNING: 'text-amber-700 dark:text-amber-400',
    INFO: 'text-blue-700 dark:text-blue-400',
  }[alert.severity] || 'text-slate-700 dark:text-slate-300'

  async function ack() {
    setBusy(true)
    try {
      await fetchApi(`/alerts/${encodeURIComponent(alert.id)}/acknowledge`, { method: 'POST' })
      onAcknowledge?.()
    } catch { /* ignore */ } finally { setBusy(false) }
  }

  return (
    <li className={`premium-card p-5 ${severityStyle}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 shadow-xs">
            <Bell size={18} className={severityText} />
          </div>
          <div>
            <span className={`font-bold text-xs uppercase tracking-wider ${severityText}`}>{alert.severity}</span>
            <span className="ml-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{alert.ruleId?.replace(/_/g, ' ')}</span>
            {alert.subjectId && alert.subjectId !== 'global' && (
              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{alert.subjectId}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : '—'}</span>
          {alert.status !== 'ACKNOWLEDGED' && (
            <button
              onClick={ack}
              disabled={busy}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-xs"
            >
              {busy ? 'Acknowledging…' : 'Acknowledge'}
            </button>
          )}
          {alert.status === 'ACKNOWLEDGED' && (
            <span className="text-xs text-slate-400 flex items-center gap-1 font-medium"><BellOff size={12} /> Acknowledged</span>
          )}
        </div>
      </div>
      {alert.reasonCode && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono">{alert.reasonCode}</p>
      )}
    </li>
  )
}

function useAlertsData() {
  const [data, setData] = React.useState(null)
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  
  function load() {
    setLoading(true)
    fetchApi('/alerts')
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  React.useEffect(() => { load() }, [])
  return { data, error, loading, reload: load }
}
