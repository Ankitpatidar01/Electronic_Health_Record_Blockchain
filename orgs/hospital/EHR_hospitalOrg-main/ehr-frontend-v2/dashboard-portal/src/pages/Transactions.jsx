import React from 'react'
import { DataView, eventRows, useDashboardData } from '../components/DataView'
import { readDashboardUser } from '../services/api'
import { TrendingUp, CheckCircle2, XCircle, AlertTriangle, Zap, Clock } from 'lucide-react'

function TxCard({ label, value, icon: Icon, alert }) {
  return (
    <div className={`bg-white border rounded-xl p-5 shadow-sm ${alert && value > 0 ? 'border-amber-200' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        {Icon && <Icon size={18} className={alert && value > 0 ? 'text-amber-500' : 'text-slate-400'} />}
      </div>
      <div className={`text-2xl font-semibold ${alert && value > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
        {value ?? '—'}
      </div>
    </div>
  )
}

function fmt(value) {
  if (value == null || (typeof value === 'object' && value.value == null)) return '—'
  const n = typeof value === 'object' ? value.value : value
  return typeof n === 'number' ? n.toFixed(typeof n === n | 0 === n ? 0 : 2) : String(n)
}

export default function Transactions() {
  const admin = readDashboardUser()?.role === 'admin'
  const { data: metrics } = useDashboardData('/transactions/metrics')
  const m = metrics?.metrics || {}

  const cards = [
    { label: 'Tx / min', value: fmt(m.txPerMin), icon: TrendingUp },
    { label: 'Successful', value: fmt(m.successCount), icon: CheckCircle2 },
    { label: 'Failed', value: fmt(m.failureCount), icon: XCircle, alert: true },
    { label: 'MVCC Conflicts', value: fmt(m.mvccConflicts), icon: AlertTriangle, alert: true },
    { label: 'Endorsement Failures', value: fmt(m.endorsementFailures), icon: Zap, alert: true },
    { label: 'Avg Latency', value: m.averageLatencyMs?.value != null ? (m.averageLatencyMs.value / 1000).toFixed(2) + 's' : '—', icon: Clock },
  ]

  return (
    <section className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
        <p className="text-slate-500 mt-1">Transaction events derived from the authorized event stream.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map(({ label, value, icon, alert }) => (
          <TxCard key={label} label={label} value={value} icon={icon} alert={alert} />
        ))}
      </div>

      <DataView
        title="Transaction Events"
        description="Individual transaction events. Patient reference hash is shown to admins only."
        path="/transactions"
        rows={eventRows}
        columns={[
          { label: 'Event ID', render: row => <span className="font-mono text-xs">{row.eventId?.slice(0, 12)}…</span> },
          { label: 'Type', key: 'eventType' },
          { label: 'Status', render: row => (
            <span className={`text-xs font-semibold ${row.status === 'COMMITTED' || row.eventType === 'TRANSACTION_COMMITTED' ? 'text-emerald-600' : row.status === 'FAILED' || row.eventType?.includes('FAILED') ? 'text-red-600' : 'text-slate-600'}`}>
              {row.status || row.eventType || '—'}
            </span>
          )},
          { label: 'Chaincode', render: row => row.payload?.chaincode || '—' },
          { label: 'Function', render: row => row.payload?.functionName || '—' },
          { label: 'Time', render: row => row.timestamp ? new Date(row.timestamp).toLocaleString() : '—' },
          ...(admin ? [{ label: 'Patient Ref Hash', render: row => row.payload?.patientIdHash || '—' }] : []),
        ]}
      />
    </section>
  )
}
