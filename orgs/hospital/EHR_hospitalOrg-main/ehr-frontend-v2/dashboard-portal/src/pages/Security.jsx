import React from 'react'
import { DataView, StatusPill, eventRows, useDashboardData, valueText } from '../components/DataView'
import { Shield, ShieldOff, AlertTriangle, UserX, Lock, XCircle } from 'lucide-react'

function SecurityMetricCard({ label, value, icon: Icon, critical, tone = 'blue' }) {
  const iconColors = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    violet: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  }[tone] || 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'

  return (
    <div className={`premium-card p-5 ${critical && value > 0 ? 'border-red-400 dark:border-red-600' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        {Icon && (
          <div className={`p-2 rounded-xl border ${iconColors}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
      <div className={`text-2xl font-bold font-display tracking-tight ${critical && value > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-50'}`}>
        {value}
      </div>
    </div>
  )
}

export default function Security() {
  const { data, error, loading } = useDashboardData('/security')
  const summary = data?.summary || {}

  const cards = [
    { label: 'Access Denials', key: 'accessDeniedCount', icon: UserX, critical: true, tone: 'rose' },
    { label: 'Consent Events', key: 'consentEventCount', icon: Lock, critical: false, tone: 'violet' },
    { label: 'VCAP Events', key: 'vcapEventCount', icon: ShieldOff, critical: false, tone: 'blue' },
    { label: 'Total Security Events', key: 'eventCount', icon: Shield, critical: false, tone: 'emerald' },
  ]

  return (
    <section className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-display tracking-tight">
          Security & Consent
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          Authorization, consent, emergency access, and VCAP security event metadata.
        </p>
      </header>

      {loading && (
        <div className="premium-card p-6 text-slate-500 dark:text-slate-400 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Auditing security policies…</span>
        </div>
      )}
      {error && (
        <div role="alert" className="premium-card p-4 border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(({ label, key, icon, critical, tone }) => (
            <SecurityMetricCard key={key} label={label} value={summary[key] ?? 0} icon={icon} critical={critical} tone={tone} />
          ))}
        </div>
      )}

      <DataView
        title="Security Events"
        description="Recent authorization, consent, and VCAP events. Patient data is filtered per your role."
        path="/security/events"
        rows={eventRows}
        columns={[
          { label: 'Event', render: row => <span className="font-mono text-xs font-semibold">{row.eventType}</span> },
          { label: 'Severity', render: row => (
            <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full ${row.severity === 'CRITICAL' ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20' : row.severity === 'WARNING' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20' : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'}`}>
              {row.severity || 'INFO'}
            </span>
          )},
          { label: 'Organization', key: 'org' },
          { label: 'Time', render: row => row.timestamp ? new Date(row.timestamp).toLocaleString() : '—' },
          { label: 'Source', key: 'source' },
          { label: 'Mock', render: row => row.mock ? <span className="text-amber-600 dark:text-amber-400 text-xs font-semibold">MOCK</span> : null },
        ]}
      />
    </section>
  )
}
