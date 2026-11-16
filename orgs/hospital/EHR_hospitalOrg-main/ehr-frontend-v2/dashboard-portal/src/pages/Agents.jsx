import React from 'react'
import { Link } from 'react-router-dom'
import { DataView, valueText, useDashboardData } from '../components/DataView'
import { CLINICAL_AGENTS, agentConfig } from '../config/agentConfig'
import { Bot, Stethoscope, Pill, FlaskConical, Heart } from 'lucide-react'

const agentRoutes = {
  'doctor-agent': '/agents/doctor',
  'nurse-agent': '/agents/nurse',
  'pharmacy-agent': '/agents/pharmacy',
  'lab-agent': '/agents/lab',
}

const agentIcons = {
  'doctor-agent': Stethoscope,
  'nurse-agent': Heart,
  'pharmacy-agent': Pill,
  'lab-agent': FlaskConical,
}

const colorMap = {
  blue: 'bg-blue-100 text-blue-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  violet: 'bg-violet-100 text-violet-600',
  cyan: 'bg-cyan-100 text-cyan-600',
}

function ClinicalAgentSummaryCard({ agentId }) {
  const cfg = agentConfig[agentId]
  const { data, loading } = useDashboardData(`/agents/${encodeURIComponent(agentId)}`)
  const Icon = agentIcons[agentId] || Bot
  const route = agentRoutes[agentId] || `/agents/${agentId}`
  const statusState = data?.agent?.status?.state
  const isOnline = statusState === 'OK' || statusState === 'ONLINE'
  const metrics = data?.metrics?.metrics || {}

  return (
    <Link to={route} className="block bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colorMap[cfg?.color] || 'bg-slate-100 text-slate-500'}`}>
            <Icon size={22} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{cfg?.title || agentId}</h3>
            <p className="text-xs text-slate-400 font-mono">{agentId}</p>
          </div>
        </div>
        {!loading && (
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {loading ? '…' : isOnline ? 'ONLINE' : statusState || 'NOT CONNECTED'}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cfg?.metrics?.slice(0, 2).map(key => {
          const label = cfg.domainMetrics?.[key] || key
          const val = metrics[key === 'successRate' ? 'successRate' : key === 'averageLatency' ? 'averageLatencyMs' : 'executions']
          return (
            <div key={key} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="font-semibold text-slate-800 text-sm mt-0.5">{loading ? '…' : valueText(val)}</div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-blue-600 mt-3 font-medium">View dashboard →</p>
    </Link>
  )
}

export default function Agents() {
  return (
    <section className="max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Agents & Peers</h1>
        <p className="text-slate-500 mt-1">Clinical agentic peers and infrastructure nodes. Only agents authorized for your account are shown.</p>
      </header>

      {/* Agentic Peer Health — Unified Comparison (PDF Section 11) */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Agentic Peer Health</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CLINICAL_AGENTS.map(id => <ClinicalAgentSummaryCard key={id} agentId={id} />)}
        </div>
      </div>

      {/* Full agent registry table */}
      <DataView
        title="All Agents & Peers Registry"
        description="Complete list of agents and peers in the configured registry."
        path="/agents"
        rows={data => {
          if (!data?.items) return []
          return data.items
        }}
        columns={[
          { label: 'Name', render: row => {
            const route = agentRoutes[row.id]
            return route
              ? <Link className="text-blue-700 hover:underline font-medium" to={route}>{row.name || row.id}</Link>
              : <Link className="text-blue-700 hover:underline" to={`/agents/${encodeURIComponent(row.id)}`}>{row.name || row.id}</Link>
          }},
          { label: 'Type', key: 'kind' },
          { label: 'Organization', key: 'org' },
          { label: 'Status', render: row => (
            <span className={`text-xs font-semibold ${row.status?.state === 'OK' ? 'text-emerald-600' : 'text-slate-500'}`}>
              {row.status?.state || 'Not connected'}
            </span>
          )},
          { label: 'Health', render: row => row.status?.reason || 'Reported by producer only' },
        ]}
      />
    </section>
  )
}
