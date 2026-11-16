import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchApi } from '../services/api'
import { LoadingSkeleton } from './LoadingSkeleton'
import { StatusBadge } from './StatusBadge'
import { AgentTrace } from './AgentTrace'
import { SeverityPill } from './SeverityPill'

function fmt(value) {
  if (value == null) return '—'
  if (typeof value === 'object') return value.value != null ? String(value.value) : value.state || '—'
  return String(value)
}

function fmtRate(value) {
  if (value == null || (typeof value === 'object' && value.value == null)) return '—'
  const n = typeof value === 'object' ? value.value : value
  return typeof n === 'number' ? (n * 100).toFixed(1) + '%' : String(n)
}

function fmtLatency(value) {
  if (value == null || (typeof value === 'object' && value.value == null)) return '—'
  const n = typeof value === 'object' ? value.value : value
  return typeof n === 'number' ? (n / 1000).toFixed(2) + 's' : String(n)
}

function KpiCard({ label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-2">{value}</div>
    </div>
  )
}

function ActivityFeed({ events }) {
  if (!events.length) return <p className="text-slate-500 text-sm">No activity events received. Waiting for a connected producer.</p>
  return (
    <ul className="divide-y divide-slate-100">
      {events.slice(0, 10).map(ev => (
        <li key={ev.eventId} className="py-2.5 flex items-start gap-3 text-sm">
          <span className="text-slate-400 font-mono text-xs mt-0.5 shrink-0">{ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '—'}</span>
          <span className="text-slate-700">{ev.eventType?.replace(/_/g, ' ')}{ev.payload?.reasonCode ? ` · ${ev.payload.reasonCode}` : ''}</span>
          {ev.mock && <span className="text-amber-600 text-xs font-medium">MOCK</span>}
        </li>
      ))}
    </ul>
  )
}

function PipelineFunnel({ stages, counts = {} }) {
  const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-cyan-500', 'bg-teal-500', 'bg-emerald-500']
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {stages.map((stage, i) => (
        <React.Fragment key={stage}>
          <div className="flex flex-col items-center">
            <div className={`text-xs font-semibold text-white px-3 py-1 rounded-lg ${colors[i % colors.length]}`}>{stage}</div>
            {counts[stage] != null && <span className="text-xs text-slate-500 mt-1">{counts[stage]}</span>}
          </div>
          {i < stages.length - 1 && <span className="text-slate-400 text-lg">→</span>}
        </React.Fragment>
      ))}
    </div>
  )
}

export function ClinicalAgentPage({ agentId, config }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchApi(`/agents/${encodeURIComponent(agentId)}`)
      .then(r => { if (active) setData(r) })
      .catch(e => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [agentId])

  if (loading) return <LoadingSkeleton className="h-48 w-full" />
  if (error) return <div role="alert" className="p-5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">{error}</div>

  const agent = data?.agent
  const metrics = data?.metrics?.metrics || {}
  const executions = data?.executions?.items || []
  const events = data?.events?.items || []
  const alertEvents = events.filter(e => ['TRANSACTION_FAILED', 'ACCESS_DENIED', 'CONSENT_REVOKED', 'AGENT_EXECUTION_FAILED'].includes(e.eventType))

  // Compute domain KPIs from metrics and events
  const kpis = {
    activeVisits: metrics.requests?.value ?? (events.filter(e => e.eventType === 'AGENT_EXECUTION_STARTED').length || null),
    aiRequests: metrics.executions?.value,
    successRate: metrics.successRate,
    averageLatency: metrics.averageLatencyMs,
    activePatients: metrics.requests?.value,
    vitalsRecorded: events.filter(e => e.eventType === 'AGENT_EXECUTION_COMPLETED').length || null,
    prescriptions: events.filter(e => e.eventType === 'TRANSACTION_COMMITTED').length || null,
    dispensed: metrics.successCount?.value,
    failedTransactions: metrics.failureCount?.value,
    reports: metrics.executions?.value,
    aiAnalyses: metrics.successCount?.value,
  }

  const colorMap = { blue: 'blue', emerald: 'emerald', violet: 'violet', cyan: 'cyan' }
  const accent = colorMap[config?.color] || 'blue'
  const statusState = agent?.status?.state || 'NOT_CONNECTED'
  const isOnline = statusState === 'OK' || statusState === 'ONLINE'

  return (
    <section className="max-w-7xl mx-auto space-y-6">
      <Link to="/agents" className="text-blue-700 hover:underline text-sm">← All Agents</Link>

      {/* Header */}
      <header className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{config?.title || agentId}</h1>
            <p className="text-slate-500 mt-1 text-sm">
              Peer: <span className="font-mono">{config?.peer || agent?.peerId || '—'}</span>
              {' · '}Agent ID: <span className="font-mono">{agentId}</span>
            </p>
            {(agent?.model || agent?.vcapStatus) && (
              <p className="text-xs text-slate-500 mt-1">
                {agent.model && <>Model: <strong>{agent.model}</strong></>}
                {agent.modelVersion && <> v{agent.modelVersion}</>}
                {agent.vcapStatus && <> · VCAP: <strong>{agent.vcapStatus}</strong></>}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {isOnline ? 'ONLINE' : statusState}
            </span>
            <span className="text-xs text-slate-400">{config?.org}</span>
          </div>
        </div>
      </header>

      {/* Domain KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {config?.metrics?.map(key => {
          const label = config.domainMetrics?.[key] || key
          let val = kpis[key]
          if (key === 'successRate') val = fmtRate(val)
          else if (key === 'averageLatency') val = fmtLatency(metrics.averageLatencyMs)
          else val = fmt(val)
          return <KpiCard key={key} label={label} value={val} />
        })}
      </div>

      {/* Lab pipeline funnel */}
      {config?.pipelineStages && (
        <article className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Processing Pipeline</h2>
          <PipelineFunnel stages={config.pipelineStages} />
          <p className="text-xs text-slate-400 mt-3">Each stage shows events flowing through the lab report processing lifecycle.</p>
        </article>
      )}

      {/* Activity feed */}
      <article className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">Clinical Activity</h2>
        <ActivityFeed events={events} />
        {!events.length && <p className="text-xs text-slate-400 mt-2">Producer status: {data?.events?.status?.state || 'Not connected'}</p>}
      </article>

      {/* Recent AI Executions */}
      <article className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">Recent AI Executions</h2>
        {executions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Execution ID', 'Model', 'Duration', 'Status', 'VCAP'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-semibold text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {executions.map(run => (
                  <tr key={run.runId} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{run.runId?.slice(0, 12)}…</td>
                    <td className="px-3 py-2">{run.model || '—'}</td>
                    <td className="px-3 py-2">{run.durationMs != null ? (run.durationMs / 1000).toFixed(1) + 's' : '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-semibold ${run.status === 'COMPLETED' ? 'text-emerald-600' : run.status === 'FAILED' ? 'text-red-600' : 'text-slate-500'}`}>{run.status}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">{run.vcapStatus || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No execution events received. Producer status: {data?.executions?.status?.state || 'Not connected'}.</p>
        )}
        {executions.some(r => r.stages?.length) && (
          <div className="mt-4 space-y-3">
            {executions.filter(r => r.stages?.length).slice(0, 3).map(run => (
              <details key={run.runId} className="border rounded-lg">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Trace: {run.runId?.slice(0, 12)}…</summary>
                <div className="px-4 pb-3"><AgentTrace stages={run.stages || []} /></div>
              </details>
            ))}
          </div>
        )}
      </article>

      {/* Alerts panel */}
      {alertEvents.length > 0 && (
        <article className="bg-red-50 border border-red-200 rounded-xl p-5">
          <h2 className="font-semibold text-red-800 mb-3">⚠ Alerts</h2>
          <ul className="space-y-2">
            {alertEvents.slice(0, 5).map(ev => (
              <li key={ev.eventId} className="flex items-center gap-3 text-sm text-red-700">
                <SeverityPill severity={ev.severity || 'WARNING'} />
                <span>{ev.eventType?.replace(/_/g, ' ')}</span>
                {ev.payload?.reasonCode && <span className="text-red-500">· {ev.payload.reasonCode}</span>}
              </li>
            ))}
          </ul>
        </article>
      )}
    </section>
  )
}
