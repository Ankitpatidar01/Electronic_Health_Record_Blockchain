// Analytics — transaction evaluation charts. Every number comes from
// /analytics/summary, which computes it from live sources at request time
// (committed blocks, gateway timing events, IPFS and agent telemetry, ledger
// counts). When a source is not connected the page says so; it never shows a
// placeholder number.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { Users, FileStack, ArrowRightLeft, Building2, Server, HeartPulse, Timer, Gauge, RefreshCw, AlertTriangle, Boxes } from 'lucide-react'
import { fetchApi } from '../services/api'
import { MetricCard } from '../components/MetricCard'

const PRESETS = [
  { id: '1h', label: 'Last hour', ms: 3600000 },
  { id: '24h', label: 'Last 24 hours', ms: 86400000 },
  { id: '7d', label: 'Last 7 days', ms: 7 * 86400000 },
  { id: '30d', label: 'Last 30 days', ms: 30 * 86400000 },
  { id: 'custom', label: 'Custom range', ms: 0 },
]
const ORG_COLOURS = { HospitalMSP: '#2563EB', DiagnosticsMSP: '#D97706', ProviderMSP: '#7C3AED' }
const ORG_LABELS = { HospitalMSP: 'Hospital', DiagnosticsMSP: 'Diagnostics', ProviderMSP: 'Provider' }
const REFRESH_MS = 15000

const n = (v, digits = 0) => (v === null || v === undefined ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: digits }))
const ms = (v) => (v === null || v === undefined ? '—' : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`)
const pct = (v) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`)
const bytes = (v) => {
  if (v === null || v === undefined) return '—'
  if (v < 1024) return `${v} B`
  if (v < 1048576) return `${(v / 1024).toFixed(1)} KB`
  return `${(v / 1048576).toFixed(2)} MB`
}
const toLocalInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

function Panel({ title, note, children, empty, emptyText }) {
  return (
    <section className="premium-card p-5">
      <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
      {note && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{note}</p>}
      <div className="mt-4">
        {empty ? <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">{emptyText}</p> : children}
      </div>
    </section>
  )
}

function StatRow({ items }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
          <dd className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function Analytics() {
  const [preset, setPreset] = useState('24h')
  const [customFrom, setCustomFrom] = useState(() => toLocalInput(new Date(Date.now() - 86400000)))
  const [customTo, setCustomTo] = useState(() => toLocalInput(new Date()))
  const [auto, setAuto] = useState(true)
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })
  const [rangeError, setRangeError] = useState('')
  const inFlight = useRef(false)

  const query = useCallback(() => {
    if (preset !== 'custom') {
      const to = new Date()
      const from = new Date(to.getTime() - PRESETS.find(p => p.id === preset).ms)
      return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`
    }
    const from = new Date(customFrom), to = new Date(customTo)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null
    if (from >= to) return null
    return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`
  }, [preset, customFrom, customTo])

  const load = useCallback(async (quiet = false) => {
    const q = query()
    if (!q) { setRangeError('Choose a start that is earlier than the end.'); return }
    setRangeError('')
    if (inFlight.current) return
    inFlight.current = true
    if (!quiet) setState(s => ({ ...s, status: s.data ? 'refreshing' : 'loading', error: '' }))
    try {
      const data = await fetchApi(`/analytics/summary?${q}`)
      setState({ status: 'ready', data, error: '' })
    } catch (err) {
      setState(s => ({ status: s.data ? 'stale' : 'error', data: s.data, error: err.message || 'Analytics could not be loaded.' }))
    } finally {
      inFlight.current = false
    }
  }, [query])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!auto || preset === 'custom') return undefined
    const timer = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(timer)
  }, [auto, preset, load])

  const data = state.data
  const tick = useMemo(() => {
    const hourly = data?.range.bucket === 'hour'
    return (iso) => new Date(iso).toLocaleString(undefined, hourly ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric' })
  }, [data?.range.bucket])
  const orgs = useMemo(() => (data ? data.transactions.byOrganization.map(o => o.name) : []), [data])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Transaction analytics</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Live from the ledger, block events and service telemetry.
            {data && <> Updated {new Date(data.generatedAt).toLocaleTimeString()}.</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span className="sr-only">Date range</span>
            <select value={preset} onChange={e => setPreset(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white">
              {PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          {preset === 'custom' && (
            <>
              <label className="text-xs text-slate-600 dark:text-slate-300">From
                <input type="datetime-local" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)}
                  className="ml-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-900 dark:text-white" />
              </label>
              <label className="text-xs text-slate-600 dark:text-slate-300">To
                <input type="datetime-local" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)}
                  className="ml-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-900 dark:text-white" />
              </label>
            </>
          )}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={auto && preset !== 'custom'} disabled={preset === 'custom'} onChange={e => setAuto(e.target.checked)} />
            Auto-refresh (15 s)
          </label>
          <button type="button" onClick={() => load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <RefreshCw size={14} className={['loading', 'refreshing'].includes(state.status) ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {rangeError && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">{rangeError}</div>}
      {state.status === 'error' && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
          {state.error} <button className="underline ml-1" onClick={() => load()}>Try again</button>
        </div>
      )}
      {state.status === 'stale' && (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Could not refresh ({state.error}). Showing the figures from {new Date(data.generatedAt).toLocaleTimeString()}.
        </div>
      )}
      {state.status === 'loading' && !data && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4" aria-busy="true" aria-label="Loading analytics">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="premium-card h-24 animate-pulse" />)}
        </div>
      )}

      {data && (
        <>
          {data.sources.fabric.status !== 'CONNECTED' && (
            <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              The dashboard is not connected to a Fabric peer (collector status: {data.sources.fabric.status}). Block, transaction and ledger figures are unavailable until it connects.
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <MetricCard title="Patients" value={n(data.overview.patients)} icon={Users} tone="blue" />
            <MetricCard title="Records (CIDs)" value={n(data.overview.records)} icon={FileStack} tone="violet" />
            <MetricCard title="Transactions in range" value={n(data.overview.transactions)} icon={ArrowRightLeft} tone="green" />
            <MetricCard title="Block height" value={n(data.overview.blockHeight)} icon={Boxes} tone="cyan" />
            <MetricCard title="Organisations / peers" value={`${n(data.overview.organizations)} / ${n(data.overview.peers)}`} icon={Building2} tone="amber" />
            <MetricCard title="Health checks up" value={data.overview.healthTargetsTotal ? `${data.overview.healthTargetsUp} / ${data.overview.healthTargetsTotal}` : '—'} icon={HeartPulse} tone={data.overview.healthTargetsUp === data.overview.healthTargetsTotal ? 'green' : 'rose'} />
          </div>

          <Panel title={`Transactions per ${data.range.bucket}, by organisation`} note="From committed blocks."
            empty={data.transactions.total === 0} emptyText="No transactions were committed in this range.">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.transactions.series}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis dataKey="timestamp" tickFormatter={tick} fontSize={11} minTickGap={24} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} />
                <Legend />
                {orgs.map(o => <Bar key={o} dataKey={o} name={ORG_LABELS[o] || o} stackId="org" fill={ORG_COLOURS[o] || '#64748B'} />)}
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Panel title="Transactions by type" note="Chaincode function, most frequent first."
              empty={data.transactions.byType.length === 0} emptyText="No transactions in this range.">
              <ResponsiveContainer width="100%" height={Math.max(180, data.transactions.byType.length * 26)}>
                <BarChart data={data.transactions.byType} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis type="number" allowDecimals={false} fontSize={11} />
                  <YAxis type="category" dataKey="name" width={150} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="count" name="Transactions" fill="#2563EB" />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Throughput and outcome" note="Committed versus rejected at validation.">
              <StatRow items={[
                ['Committed', n(data.transactions.committed)],
                ['Failed', n(data.transactions.failed)],
                ['Success rate', pct(data.transactions.successRate)],
                ['Average TPS', n(data.transactions.averageTps, 4)],
                ['Peak TPS', n(data.transactions.peakTps, 4)],
                [`Peak per ${data.range.bucket}`, n(data.transactions.peakPerBucket)],
              ]} />
              {data.transactions.total > 0 && (
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={170}>
                    <AreaChart data={data.transactions.series}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                      <XAxis dataKey="timestamp" tickFormatter={tick} fontSize={11} minTickGap={24} />
                      <YAxis allowDecimals={false} fontSize={11} />
                      <Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} />
                      <Legend />
                      <Area dataKey="committed" name="Committed" stackId="s" stroke="#059669" fill="#059669" fillOpacity={0.35} />
                      <Area dataKey="failed" name="Failed" stackId="s" stroke="#DC2626" fill="#DC2626" fillOpacity={0.45} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              {data.transactions.failuresByReason.length > 0 && (
                <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                  Failures: {data.transactions.failuresByReason.map(f => `${f.name.replace(/_/g, ' ').toLowerCase()} (${f.count})`).join(', ')}
                </p>
              )}
            </Panel>
          </div>

          <Panel title="Time to complete a transaction (submit → commit)" note="Measured by each gateway from the moment it submits until the peer reports the commit."
            empty={data.latency.count === 0} emptyText="No transactions were submitted through the gateways in this range.">
            <StatRow items={[
              ['Transactions', n(data.latency.count)],
              ['Average', ms(data.latency.avg)],
              ['Minimum', ms(data.latency.min)],
              ['Median', ms(data.latency.median)],
              ['95th percentile', ms(data.latency.p95)],
              ['Maximum', ms(data.latency.max)],
            ]} />
            <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.latency.series}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis dataKey="timestamp" tickFormatter={tick} fontSize={11} minTickGap={24} />
                  <YAxis fontSize={11} unit=" ms" width={70} />
                  <Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} formatter={(v) => ms(v)} />
                  <Legend />
                  <Line dataKey="avg" name="Average" stroke="#2563EB" dot={false} connectNulls />
                  <Line dataKey="p95" name="95th percentile" stroke="#D97706" dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
              <div className="overflow-x-auto">
                <table className="premium-table w-full text-sm">
                  <thead><tr><th className="text-left">Transaction type</th><th className="text-right">Count</th><th className="text-right">Average</th><th className="text-right">Median</th><th className="text-right">p95</th><th className="text-right">Max</th></tr></thead>
                  <tbody>
                    {data.latency.byFunction.map(f => (
                      <tr key={f.name}><td>{f.name}</td><td className="text-right tabular-nums">{n(f.count)}</td><td className="text-right tabular-nums">{ms(f.avg)}</td><td className="text-right tabular-nums">{ms(f.median)}</td><td className="text-right tabular-nums">{ms(f.p95)}</td><td className="text-right tabular-nums">{ms(f.max)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {data.latency.failedSubmissions > 0 && <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">{n(data.latency.failedSubmissions)} submission(s) were rejected before commit and are not included in the timings.</p>}
          </Panel>

          <Panel title="Block time and block size" note="Interval between consecutive blocks and serialized size of each block."
            empty={data.blocks.count === 0} emptyText="No blocks were produced in this range.">
            <StatRow items={[
              ['Blocks', n(data.blocks.count)],
              ['Avg block time', data.blocks.averageIntervalSec === null ? '—' : `${n(data.blocks.averageIntervalSec)} s`],
              ['Median block time', data.blocks.medianIntervalSec === null ? '—' : `${n(data.blocks.medianIntervalSec)} s`],
              ['Avg tx per block', n(data.blocks.averageTxPerBlock, 2)],
              ['Avg block size', bytes(data.blocks.averageSizeBytes)],
              ['Largest block', bytes(data.blocks.maxSizeBytes)],
            ]} />
            <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.blocks.series}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis dataKey="blockNumber" fontSize={11} />
                  <YAxis fontSize={11} unit=" s" width={60} />
                  <Tooltip labelFormatter={(v) => `Block ${v}`} />
                  <Line dataKey="intervalSec" name="Seconds since previous block" stroke="#7C3AED" dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.blocks.series}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis dataKey="blockNumber" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={bytes} width={70} />
                  <Tooltip labelFormatter={(v) => `Block ${v}`} formatter={(v) => bytes(v)} />
                  <Bar dataKey="sizeBytes" name="Block size" fill="#0891B2" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Panel title="IPFS upload and retrieval" note="Reported by the IPFS service for every pin and fetch."
              empty={data.ipfs.uploads.count === 0 && data.ipfs.retrievals.count === 0} emptyText="No IPFS activity in this range.">
              <StatRow items={[
                ['Uploads', n(data.ipfs.uploads.count)],
                ['Avg upload', ms(data.ipfs.uploads.avg)],
                ['p95 upload', ms(data.ipfs.uploads.p95)],
                ['Retrievals', n(data.ipfs.retrievals.count)],
                ['Avg retrieval', ms(data.ipfs.retrievals.avg)],
                ['p95 retrieval', ms(data.ipfs.retrievals.p95)],
              ]} />
              <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">Stored in range: {bytes(data.ipfs.uploads.totalBytes)} · Failures: {n(data.ipfs.failures)}</p>
              <div className="mt-3">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data.ipfs.series}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                    <XAxis dataKey="timestamp" tickFormatter={tick} fontSize={11} minTickGap={24} />
                    <YAxis fontSize={11} tickFormatter={bytes} width={70} />
                    <Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} formatter={(v) => bytes(v)} />
                    <Area dataKey="cumulativeBytes" name="Storage growth in range" stroke="#0891B2" fill="#0891B2" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="AI agents" note="Runs, response time, and how often the doctor's code matched the AI suggestion.">
              {data.agents.items.length === 0 ? <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No agent runs in this range.</p> : (
                <div className="overflow-x-auto">
                  <table className="premium-table w-full text-sm">
                    <thead><tr><th className="text-left">Agent</th><th className="text-right">Runs</th><th className="text-right">Completed</th><th className="text-right">Failed</th><th className="text-right">Avg response</th><th className="text-right">p95</th></tr></thead>
                    <tbody>
                      {data.agents.items.map(a => (
                        <tr key={a.agentId}><td>{a.agentId}</td><td className="text-right tabular-nums">{n(a.executions)}</td><td className="text-right tabular-nums">{n(a.completed)}</td><td className="text-right tabular-nums">{n(a.failed)}</td><td className="text-right tabular-nums">{ms(a.responseMs.avg)}</td><td className="text-right tabular-nums">{ms(a.responseMs.p95)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4">
                {data.agents.codeMatch ? (
                  <StatRow items={[
                    ['Doctor decisions', n(data.agents.codeMatch.doctorDecisions)],
                    ['With AI suggestion', n(data.agents.codeMatch.decisionsWithAiSuggestion)],
                    ['Matched AI', n(data.agents.codeMatch.matchedAiSuggestion)],
                    ['AI match rate', pct(data.agents.codeMatch.aiMatchRate)],
                    ['Matched template', n(data.agents.codeMatch.matchedProvisional)],
                    ['Template match rate', pct(data.agents.codeMatch.provisionalMatchRate)],
                  ]} />
                ) : <p className="text-sm text-slate-500 dark:text-slate-400">Code match figures need the ledger connection.</p>}
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Match rates are read from the ledger and cover all time, not only the selected range.</p>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
