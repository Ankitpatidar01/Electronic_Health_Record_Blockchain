import React from 'react'
import { useDashboardData } from '../components/DataView'
import { Database, Server, HardDrive, Upload, AlertCircle, Link2Off } from 'lucide-react'

function IpfsStatusCard({ label, value, icon: Icon, online, detail }) {
  const isOnline = online === true
  const isOffline = online === false
  return (
    <div className={`bg-white border rounded-xl p-5 shadow-sm ${isOffline ? 'border-red-200' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        {Icon && <Icon size={18} className={isOffline ? 'text-red-400' : isOnline ? 'text-emerald-400' : 'text-slate-400'} />}
      </div>
      <div className={`text-2xl font-semibold ${isOffline ? 'text-red-700' : 'text-slate-900'}`}>
        {online !== undefined ? (
          <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2 py-0.5 rounded-full ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        ) : (
          value ?? '—'
        )}
      </div>
      {detail && <p className="text-xs text-slate-400 mt-1">{detail}</p>}
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
        <h1 className="text-2xl font-bold text-slate-900">IPFS Observations</h1>
        <p className="text-slate-500 mt-1">Operational event counts only. Content, CIDs, and patient documents are not displayed.</p>
      </header>

      {loading && <p className="p-4 bg-white border rounded-lg text-slate-500">Loading IPFS data…</p>}
      {error && <p role="alert" className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">{error}</p>}

      {data && (
        <>
          <div className={`p-3 rounded-lg text-sm border ${isNodeOnline ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : isNodeOffline ? 'bg-red-50 border-red-200 text-red-800' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
            {status?.state || 'Status unavailable'}
            {status?.reason ? ` · ${status.reason}` : ''}
            {status?.mock ? ' · MOCK DATA' : ''}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <IpfsStatusCard label="Node Status" icon={Server} online={isNodeOnline ? true : isNodeOffline ? false : undefined} />
            <IpfsStatusCard label="Gateway Status" icon={Database} online={isNodeOnline ? true : isNodeOffline ? false : undefined} detail="Via IPFS service health" />
            <IpfsStatusCard label="Storage Used" icon={HardDrive} value={metrics.storageUsage?.status?.state || 'Not reported'} detail="Deferred — IPFS API does not expose storage usage yet" />
            <IpfsStatusCard label="Uploads" icon={Upload} value={metrics.uploads ?? '—'} />
            <IpfsStatusCard label="Upload Failures" icon={AlertCircle} value={metrics.failures ?? '—'} />
            <IpfsStatusCard label="CID Resolution Failures" icon={Link2Off} value={metrics.cidResolutionFailures ?? '—'} />
          </div>
        </>
      )}
    </section>
  )
}
