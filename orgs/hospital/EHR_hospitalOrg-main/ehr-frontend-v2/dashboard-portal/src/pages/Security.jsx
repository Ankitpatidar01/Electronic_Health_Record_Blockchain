import React from 'react'
import { DataView, eventRows, useDashboardData, valueText } from '../components/DataView'
import { Shield, ShieldOff, AlertTriangle, UserX, Lock, XCircle } from 'lucide-react'

function SecurityMetricCard({ label, value, icon: Icon, critical }) {
  return (
    <div className={`bg-white border rounded-xl p-5 shadow-sm ${critical && value > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        {Icon && <Icon size={18} className={critical && value > 0 ? 'text-red-500' : 'text-slate-400'} />}
      </div>
      <div className={`text-2xl font-semibold ${critical && value > 0 ? 'text-red-700' : 'text-slate-900'}`}>
        {value ?? '—'}
      </div>
    </div>
  )
}

export default function Security() {
  const { data, error, loading } = useDashboardData('/security')
  const summary = data?.summary || {}

  const cards = [
    { label: 'Access Denials', key: 'accessDeniedCount', icon: UserX, critical: true },
    { label: 'Consent Events', key: 'consentEventCount', icon: Lock, critical: false },
    { label: 'VCAP Events', key: 'vcapEventCount', icon: ShieldOff, critical: false },
    { label: 'Total Security Events', key: 'eventCount', icon: Shield, critical: false },
  ]

  return (
    <section className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Security & Consent</h1>
        <p className="text-slate-500 mt-1">Authorization, consent, emergency access, and VCAP security event metadata.</p>
      </header>

      {loading && <p className="p-4 bg-white border rounded-lg text-slate-500">Loading security data…</p>}
      {error && <p role="alert" className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">{error}</p>}

      {data && (
        <>
          <div className={`p-3 rounded-lg text-sm border ${summary.status?.state === 'OK' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
            {summary.status?.state || 'Status unavailable'}
            {summary.status?.reason ? ` · ${summary.status.reason}` : ''}
            {summary.status?.mock ? ' · MOCK DATA' : ''}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map(({ label, key, icon, critical }) => (
              <SecurityMetricCard key={key} label={label} value={summary[key]} icon={icon} critical={critical} />
            ))}
          </div>
        </>
      )}

      <DataView
        title="Security Events"
        description="Recent authorization, consent, and VCAP events. Patient data is filtered per your role."
        path="/security/events"
        rows={eventRows}
        columns={[
          { label: 'Event', key: 'eventType' },
          { label: 'Severity', render: row => (
            <span className={`text-xs font-semibold uppercase ${row.severity === 'CRITICAL' ? 'text-red-600' : row.severity === 'WARNING' ? 'text-amber-600' : 'text-slate-500'}`}>
              {row.severity || '—'}
            </span>
          )},
          { label: 'Organization', key: 'org' },
          { label: 'Time', render: row => row.timestamp ? new Date(row.timestamp).toLocaleString() : '—' },
          { label: 'Source', key: 'source' },
          { label: 'Mock', render: row => row.mock ? <span className="text-amber-600 text-xs">MOCK</span> : null },
        ]}
      />
    </section>
  )
}
