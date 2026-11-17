import React from 'react'
import { DataView, useDashboardData } from '../components/DataView'
import { Network as NetworkIcon, Server, ArrowUpDown, Hash, Layers, TrendingUp } from 'lucide-react'

function NetCard({ label, value, icon: Icon, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        {Icon && <Icon size={18} className="text-slate-400" />}
      </div>
      <div className="text-2xl font-semibold text-slate-900">{value ?? '—'}</div>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function Network() {
  const { data, error, loading } = useDashboardData('/network')

  const peers = data?.peers || []
  const orderers = data?.orderers || []
  const channels = data?.channels || []
  const orgs = data?.organizations || []
  const txMetrics = data?.transactionSummary?.metrics || {}

  const onlinePeers = peers.filter(p => p.status?.state === 'OK').length
  const blockHeight = peers.map(p => p.blockHeight).filter(Boolean).reduce((a, b) => Math.max(a, b), null)
    || channels[0]?.blockHeight
    || (data?.collector?.lastProcessedBlock !== null && data?.collector?.lastProcessedBlock !== undefined ? Number(data.collector.lastProcessedBlock) + 1 : null)

  return (
    <section className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Blockchain Network</h1>
        <p className="text-slate-500 mt-1">Peer status and block height require Fabric observations. Application health checks are listed separately.</p>
      </header>

      {loading && <p className="p-4 bg-white border rounded-lg text-slate-500">Loading network data…</p>}
      {error && <p role="alert" className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">{error}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <NetCard label="Organizations" value={orgs.length || data?.topology?.organizations?.length || 3} icon={Layers} />
            <NetCard label="Peers" value={`${onlinePeers}/${peers.length}`} icon={Server} sub="Online / Configured" />
            <NetCard label="Orderers" value={orderers.length} icon={ArrowUpDown} />
            <NetCard label="Channel" value={channels[0]?.id || data?.channel || '—'} icon={Hash} sub={channels[0]?.chaincode ? `Chaincode: ${channels[0].chaincode}` : undefined} />
            <NetCard label="Block Height" value={blockHeight ?? '—'} icon={Layers} sub="Latest committed block" />
            <NetCard label="Tx/min" value={txMetrics.txPerMin?.value ?? '—'} icon={TrendingUp} sub="5-min window" />
          </div>
        </>
      )}

      <DataView
        title="Peers, Orderers & Services"
        description="All configured nodes. Fabric block height requires a connected observer."
        path="/network"
        rows={data => [
          ...(data?.peers || []).map(row => ({ ...row, rowKind: 'Peer' })),
          ...(data?.orderers || []).map(row => ({ ...row, rowKind: 'Orderer' })),
          ...(data?.services || []).map(row => ({ ...row, rowKind: `${row.kind} service`, blockHeight: null })),
        ]}
        columns={[
          { label: 'Name', key: 'id' },
          { label: 'Type', key: 'rowKind' },
          { label: 'Organization', render: row => row.org || row.mspId || '—' },
          { label: 'Status', render: row => (
            <span className={`text-xs font-semibold ${row.status?.state === 'OK' ? 'text-emerald-600' : 'text-slate-500'}`}>
              {row.status?.state || 'Not connected'}
            </span>
          )},
          { label: 'Block Height', render: row => row.blockHeight ?? '—' },
          { label: 'Details', render: row => row.status?.reason || row.heightStatus?.reason || '—' },
          { label: 'Last Checked', render: row => row.lastCheckedAt ? new Date(row.lastCheckedAt).toLocaleTimeString() : '—' },
        ]}
      />
    </section>
  )
}
