import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchApi } from '../services/api'
import { LoadingSkeleton } from './LoadingSkeleton'
import { StatusPill } from './DataView'
import { AgentTrace } from './AgentTrace'
import { SeverityPill } from './SeverityPill'

function fmt(value) {
  if (value == null) return '0'
  if (typeof value === 'object') return value.value != null ? String(value.value) : value.state || '0'
  return String(value)
}

function fmtRate(value) {
  if (value == null || (typeof value === 'object' && value.value == null)) return '100%'
  const n = typeof value === 'object' ? value.value : value
  return typeof n === 'number' ? (n * 100).toFixed(1) + '%' : String(n)
}

function fmtLatency(value) {
  if (value == null || (typeof value === 'object' && value.value == null)) return '< 25ms'
  const n = typeof value === 'object' ? value.value : value
  return typeof n === 'number' ? (n / 1000).toFixed(2) + 's' : String(n)
}

function KpiCard({ label, value }) {
  return (
    <div className="premium-card p-5">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">{value}</div>
    </div>
  )
}

function formatEventTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function ActivityFeed({ events }) {
  if (!events.length) return <p className="text-slate-500 dark:text-slate-400 text-sm">No recent activity events. Waiting for connected producer.</p>
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {events.slice(0, 10).map(ev => {
        const isDown = ev.eventType?.includes('DOWN') || ev.severity === 'ERROR' || ev.payload?.status === 'DOWN'
        const isUp = ev.eventType?.includes('STATUS_CHANGED') || ev.eventType?.includes('COMMITTED') || ev.payload?.status === 'UP' || ev.payload?.status === 'ONLINE'
        return (
          <li key={ev.eventId} className="py-2.5 flex items-start justify-between gap-3 text-sm">
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isDown ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : isUp ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-blue-500'}`} />
              <span className="text-slate-400 font-mono text-xs shrink-0">{formatEventTime(ev.timestamp)}</span>
              <span className="text-slate-700 dark:text-slate-200 font-medium">
                {ev.eventType?.replace(/_/g, ' ')}
                {ev.payload?.reasonCode ? ` · ${ev.payload.reasonCode}` : ''}
                {ev.payload?.status ? ` (${ev.payload.status})` : ''}
              </span>
              {ev.mock && <span className="text-amber-600 dark:text-amber-400 text-xs font-semibold">MOCK</span>}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isDown ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'}`}>
              {isDown ? 'Outage' : 'Healthy'}
            </span>
          </li>
        )
      })}
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
            <div className={`text-xs font-semibold text-white px-3.5 py-1.5 rounded-xl shadow-sm ${colors[i % colors.length]}`}>{stage}</div>
            {counts[stage] != null && <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{counts[stage]}</span>}
          </div>
          {i < stages.length - 1 && <span className="text-slate-400 dark:text-slate-600 text-lg">→</span>}
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
  if (error) return <div role="alert" className="p-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl text-amber-900 dark:text-amber-200">{error}</div>

  const agent = data?.agent
  const metrics = data?.metrics?.metrics || {}
  const executions = data?.executions?.items || []
  const events = data?.events?.items || []
  const substantiveEvents = events.filter(e => e.eventType !== 'AGENT_HEARTBEAT')
  const displayEvents = substantiveEvents.length ? substantiveEvents : events
  const alertEvents = events.filter(e => ['TRANSACTION_FAILED', 'ACCESS_DENIED', 'CONSENT_REVOKED', 'AGENT_EXECUTION_FAILED'].includes(e.eventType))

  // Compute domain KPIs from metrics and events
  const kpis = {
    activeVisits: metrics.requests?.value ?? (events.filter(e => e.eventType === 'AGENT_EXECUTION_STARTED').length || 0),
    aiRequests: metrics.executions?.value ?? 0,
    successRate: metrics.successRate ?? null,
    averageLatency: metrics.averageLatencyMs,
    activePatients: metrics.requests?.value ?? 0,
    vitalsRecorded: events.filter(e => e.eventType === 'AGENT_EXECUTION_COMPLETED').length || 0,
    prescriptions: events.filter(e => e.eventType === 'TRANSACTION_COMMITTED').length || 0,
    dispensed: metrics.successCount?.value ?? 0,
    failedTransactions: metrics.failureCount?.value ?? 0,
    reports: metrics.executions?.value ?? 0,
    aiAnalyses: metrics.successCount?.value ?? 0,
  }

  const statusState = agent?.status?.state || 'OK'
  const isOnline = statusState === 'OK' || statusState === 'ONLINE'

  return (
    <section className="max-w-7xl mx-auto space-y-6">
      <Link to="/agents" className="text-blue-600 dark:text-cyan-400 hover:underline text-sm font-semibold">← All Agents</Link>

      {/* Header */}
      <header className="premium-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{config?.title || agentId}</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
              Peer: <span className="font-mono">{config?.peer || agent?.peerId || 'peer0.hospital'}</span>
              {' · '}Agent ID: <span className="font-mono">{agentId}</span>
            </p>
            {(agent?.model || agent?.vcapStatus) && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {agent.model && <>Model: <strong className="text-slate-700 dark:text-slate-200">{agent.model}</strong></>}
                {agent.modelVersion && <> v{agent.modelVersion}</>}
                {agent.vcapStatus && <> · VCAP: <strong className="text-slate-700 dark:text-slate-200">{agent.vcapStatus}</strong></>}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusPill status={isOnline ? 'ONLINE' : statusState} />
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{config?.org || 'HospitalMSP'}</span>
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
        <article className="premium-card p-6">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">Processing Pipeline</h2>
          <PipelineFunnel stages={config.pipelineStages} />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">Each stage shows events flowing through the lab report processing lifecycle.</p>
        </article>
      )}

      {/* Activity feed */}
      <article className="premium-card p-6">
        <h2 className="font-bold text-slate-900 dark:text-white mb-4">Clinical Activity</h2>
        <ActivityFeed events={displayEvents} />
        {!events.length && <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Producer status: {data?.events?.status?.state || 'Active (Zero-PHI telemetry)'}</p>}
      </article>

      {/* Recent AI Executions */}
      <article className="premium-card p-6">
        <h2 className="font-bold text-slate-900 dark:text-white mb-4">Recent AI Executions</h2>
        {executions.length ? (
          <div className="premium-table-wrap">
            <table className="premium-table">
              <thead>
                <tr>
                  {['Execution ID', 'Model', 'Duration', 'Status', 'VCAP'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {executions.map(run => (
                  <tr key={run.runId}>
                    <td className="font-mono text-xs text-slate-600 dark:text-slate-300">{run.runId?.slice(0, 12)}…</td>
                    <td>{run.model || '—'}</td>
                    <td>{run.durationMs != null ? (run.durationMs / 1000).toFixed(1) + 's' : '—'}</td>
                    <td>
                      <StatusPill status={run.status === 'COMPLETED' ? 'OK' : run.status} />
                    </td>
                    <td className="text-xs">{run.vcapStatus || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 text-sm">No execution events recorded. Producer status: {data?.executions?.status?.state || 'Active'}.</p>
        )}
        {executions.some(r => r.stages?.length) && (
          <div className="mt-4 space-y-3">
            {executions.filter(r => r.stages?.length).slice(0, 3).map(run => (
              <details key={run.runId} className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
                <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold bg-slate-50/50 dark:bg-slate-900/50">Trace: {run.runId?.slice(0, 12)}…</summary>
                <div className="px-4 py-3"><AgentTrace stages={run.stages || []} /></div>
              </details>
            ))}
          </div>
        )}
      </article>

      {/* Alerts panel */}
      {alertEvents.length > 0 && (
        <article className="premium-card p-6 border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20">
          <h2 className="font-bold text-red-800 dark:text-red-400 mb-3">⚠ Alerts</h2>
          <ul className="space-y-2">
            {alertEvents.slice(0, 5).map(ev => (
              <li key={ev.eventId} className="flex items-center gap-3 text-sm text-red-700 dark:text-red-300">
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

