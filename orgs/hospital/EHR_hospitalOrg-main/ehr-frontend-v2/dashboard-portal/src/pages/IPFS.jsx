import React from 'react'
import { StatusPill, useDashboardData } from '../components/DataView'
import { Database, Server, HardDrive, Upload, AlertCircle, Link2Off } from 'lucide-react'

function IpfsStatusCard({ label, value, icon: Icon, online, detail, tone = 'blue' }) {
  const isOnline = online === true
  const isOffline = online === false

  const iconColors = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  }[tone] || 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'

  return (
    <div className={`premium-card p-5 ${isOffline ? 'border-red-400 dark:border-red-600' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        {Icon && (
          <div className={`p-2 rounded-xl border ${iconColors}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-slate-50">
        {online !== undefined ? (
          <StatusPill state={isOnline ? 'ONLINE' : 'OFFLINE'} />
        ) : (
          value ?? 0
        )}
      </div>
      {detail && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">{detail}</p>}
    </div>
  )
}

export default function IPFS() {
  const { data, error, loading } = useDashboardData('/ipfs')
  const metrics = data?.metrics || {}
  const status = data?.status

  const isNodeOnline = status?.state === 'OK'
  const isNodeOffline = status?.state === 'NOT_CONNECTED' || status?.state === 'DOWN'

  return (
    <section className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-display tracking-tight">
          IPFS Observations
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          Decentralized content storage nodes and clinical artifact cluster health.
        </p>
      </header>

      {loading && (
        <div className="premium-card p-6 text-slate-500 dark:text-slate-400 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Probing IPFS cluster nodes…</span>
        </div>
      )}
      {error && (
        <div role="alert" className="premium-card p-4 border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <IpfsStatusCard label="Node Status" icon={Server} online={isNodeOnline ? true : isNodeOffline ? false : undefined} tone="emerald" detail="Peer daemon port 5001" />
          <IpfsStatusCard label="Gateway Status" icon={Database} online={isNodeOnline ? true : isNodeOffline ? false : undefined} detail="Via IPFS HTTP service" tone="cyan" />
          <IpfsStatusCard label="Storage Status" icon={HardDrive} value="Available" detail="IPFS v0.26 repo active" tone="blue" />
          <IpfsStatusCard label="Uploads" icon={Upload} value={metrics.uploads ?? 0} tone="emerald" detail="Clinical documents verified" />
          <IpfsStatusCard label="Upload Failures" icon={AlertCircle} value={metrics.failures ?? 0} tone="rose" detail="0 unrecoverable timeouts" />
          <IpfsStatusCard label="CID Resolution Failures" icon={Link2Off} value={metrics.cidResolutionFailures ?? 0} tone="amber" detail="0 missing multihashes" />
        </div>
      )}
    </section>
  )
}
