import React, { useState } from 'react'
import { fetchApi } from '../services/api'
import { Bell, BellOff, CheckCircle2 } from 'lucide-react'

export default function Alerts() {
  const { data, error, loading, reload } = useAlertsData()

  return (
    <section className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Active Alerts</h1>
        <p className="text-slate-500 mt-1">Threshold-based alerts raised by the dashboard alert engine. Alerts resolve automatically when conditions clear.</p>
      </header>

      {loading && <p className="p-4 bg-white border rounded-lg text-slate-500">Loading alerts…</p>}
      {error && <p role="alert" className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">{error}</p>}

      {data && (
        data.items?.length ? (
          <ul className="space-y-3">
            {data.items.map(alert => (
              <AlertRow key={alert.id} alert={alert} onAcknowledge={reload} />
            ))}
          </ul>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={32} />
            <p className="font-semibold text-emerald-800">All clear — no active alerts</p>
            <p className="text-sm text-emerald-600 mt-1">The alert engine is monitoring {data.status?.reason || 'configured thresholds'}.</p>
          </div>
        )
      )}
    </section>
  )
}

function AlertRow({ alert, onAcknowledge }) {
  const [busy, setBusy] = useState(false)
  const severityStyle = {
    CRITICAL: 'border-red-300 bg-red-50',
    HIGH: 'border-orange-300 bg-orange-50',
    WARNING: 'border-amber-300 bg-amber-50',
    INFO: 'border-blue-200 bg-blue-50',
  }[alert.severity] || 'border-slate-200 bg-white'
  const severityText = {
    CRITICAL: 'text-red-700',
    HIGH: 'text-orange-700',
    WARNING: 'text-amber-700',
    INFO: 'text-blue-700',
  }[alert.severity] || 'text-slate-700'

  async function ack() {
    setBusy(true)
    try {
      await fetchApi(`/alerts/${encodeURIComponent(alert.id)}/acknowledge`, { method: 'POST' })
      onAcknowledge?.()
    } catch { /* ignore */ } finally { setBusy(false) }
  }

  return (
    <li className={`border rounded-xl p-5 shadow-sm ${severityStyle}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bell size={18} className={severityText} />
          <div>
            <span className={`font-semibold text-sm uppercase tracking-wide ${severityText}`}>{alert.severity}</span>
            <span className="ml-2 text-sm text-slate-700">{alert.ruleId?.replace(/_/g, ' ')}</span>
            {alert.subjectId && alert.subjectId !== 'global' && (
              <span className="ml-2 text-xs text-slate-500 font-mono">{alert.subjectId}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-500">{alert.timestamp ? new Date(alert.timestamp).toLocaleString() : '—'}</span>
          {alert.status !== 'ACKNOWLEDGED' && (
            <button
              onClick={ack}
              disabled={busy}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
            >
              {busy ? 'Acknowledging…' : 'Acknowledge'}
            </button>
          )}
          {alert.status === 'ACKNOWLEDGED' && (
            <span className="text-xs text-slate-400 flex items-center gap-1"><BellOff size={12} /> Acknowledged</span>
          )}
        </div>
      </div>
      {alert.reasonCode && (
        <p className="mt-2 text-xs text-slate-500 font-mono">{alert.reasonCode}</p>
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
