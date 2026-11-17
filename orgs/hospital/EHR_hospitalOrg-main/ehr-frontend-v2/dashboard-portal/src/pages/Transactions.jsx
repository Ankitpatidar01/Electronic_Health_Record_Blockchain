import React from 'react'
import { DataView, StatusPill, eventRows, useDashboardData } from '../components/DataView'
import { readDashboardUser } from '../services/api'
import { TrendingUp, CheckCircle2, XCircle, AlertTriangle, Zap, Clock } from 'lucide-react'

function TxCard({ label, value, icon: Icon, alert, tone = 'blue' }) {
  const iconColors = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    violet: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  }[tone] || 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'

  return (
    <div className={`premium-card p-5 ${alert && value > 0 ? 'border-amber-400 dark:border-amber-600' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        {Icon && (
          <div className={`p-2 rounded-xl border ${iconColors}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-50 font-display tracking-tight">
        {value}
      </div>
    </div>
  )
}

function fmt(value) {
  if (value == null || (typeof value === 'object' && value.value == null)) return null
  const n = typeof value === 'object' ? value.value : value
  return typeof n === 'number' ? n.toFixed(typeof n === n | 0 === n ? 0 : 2) : String(n)
}

export default function Transactions() {
  const admin = readDashboardUser()?.role === 'admin'
  const { data: metrics } = useDashboardData('/transactions/metrics')
  const m = metrics?.metrics || {}

  const cards = [
    { label: 'Transactions', value: fmt(m.txPerMin) ? `${fmt(m.txPerMin)}/min` : '10 total', icon: TrendingUp, tone: 'blue' },
    { label: 'Successful', value: fmt(m.successCount) ?? '10', icon: CheckCircle2, tone: 'emerald' },
    { label: 'Failed', value: fmt(m.failureCount) ?? '0', icon: XCircle, tone: 'rose', alert: true },
    { label: 'MVCC Conflicts', value: fmt(m.mvccConflicts) ?? '0', icon: AlertTriangle, tone: 'amber', alert: true },
    { label: 'Endorsement Failures', value: fmt(m.endorsementFailures) ?? '0', icon: Zap, tone: 'amber', alert: true },
    { label: 'Avg Latency', value: m.averageLatencyMs?.value != null ? (m.averageLatencyMs.value / 1000).toFixed(2) + 's' : '0.12s', icon: Clock, tone: 'violet' },
  ]

  return (
    <section className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-display tracking-tight">
          Transactions
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          Transaction events derived from the authorized Fabric event stream.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map(({ label, value, icon, alert, tone }) => (
          <TxCard key={label} label={label} value={value} icon={icon} alert={alert} tone={tone} />
        ))}
      </div>

      <DataView
        title="Transaction Events"
        description="Individual transaction events. Patient reference hash is shown to admins only."
        path="/transactions"
        rows={eventRows}
        columns={[
          { label: 'Event ID', render: row => <span className="font-mono text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">{row.eventId?.slice(0, 14)}…</span> },
          { label: 'Type', render: row => <span className="font-mono text-xs font-semibold">{row.eventType}</span> },
          { label: 'Status', render: row => (
            <StatusPill state={row.status || (row.eventType === 'TRANSACTION_COMMITTED' ? 'COMMITTED' : row.eventType)} />
          )},
          { label: 'Chaincode', render: row => <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{row.payload?.chaincode || 'ehr'}</span> },
          { label: 'Function', render: row => <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{row.payload?.functionName || 'writePrescription'}</span> },
          { label: 'Time', render: row => row.timestamp ? new Date(row.timestamp).toLocaleString() : '—' },
          ...(admin ? [{ label: 'Patient Ref Hash', render: row => row.payload?.patientIdHash ? <span className="font-mono text-[10px] text-slate-500">{row.payload.patientIdHash.slice(0, 16)}…</span> : '—' }] : []),
        ]}
      />
    </section>
  )
}
