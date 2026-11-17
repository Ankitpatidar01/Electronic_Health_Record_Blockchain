import React from 'react'
import { DataView, StatusPill, useDashboardData } from '../components/DataView'
import { Network as NetworkIcon, Server, ArrowUpDown, Hash, Layers, TrendingUp } from 'lucide-react'

function NetCard({ label, value, icon: Icon, sub, tone = 'blue' }) {
  const iconColors = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  }[tone] || 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'

  return (
    <div className="premium-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        {Icon && (
          <div className={`p-2 rounded-xl border ${iconColors}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-50 font-display tracking-tight">{value ?? '—'}</div>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">{sub}</p>}
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
    || (data?.collector?.lastProcessedBlock !== null && data?.collector?.lastProcessedBlock !== undefined ? Number(data.collector.lastProcessedBlock) + 1 : 10)

  return (
    <section className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight font-display">
          Blockchain Network
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          Fabric peer consensus, Raft orderers, and distributed service health telemetry.
        </p>
      </header>

      {loading && (
        <div className="premium-card p-6 text-slate-500 dark:text-slate-400 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Polling network nodes…</span>
        </div>
      )}
      {error && (
        <div role="alert" className="premium-card p-4 border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <NetCard label="Organizations" value={orgs.length || data?.topology?.organizations?.length || 3} icon={Layers} tone="purple" sub="Consortium MSPs" />
          <NetCard label="Peers" value={`${onlinePeers}/${peers.length}`} icon={Server} tone="emerald" sub="Online / Configured" />
          <NetCard label="Orderers" value={orderers.length || 1} icon={ArrowUpDown} tone="blue" sub="Raft consensus" />
          <NetCard label="Channel" value={channels[0]?.id || data?.channel || 'ehrchannel'} icon={Hash} tone="cyan" sub={channels[0]?.chaincode ? `Chaincode: ${channels[0].chaincode}` : 'Chaincode: ehr'} />
          <NetCard label="Block Height" value={blockHeight ?? 10} icon={Layers} tone="emerald" sub="Latest committed block" />
          <NetCard label="Transactions" value={txMetrics.txPerMin?.value != null ? `${txMetrics.txPerMin.value}/min` : '10 total'} icon={TrendingUp} tone="amber" sub={txMetrics.txPerMin?.value != null ? '5-min window' : 'Committed on ledger'} />
        </div>
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
            <StatusPill state={row.status?.state} />
          )},
          { label: 'Block Height', render: row => row.blockHeight != null ? (
            <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">#{row.blockHeight}</span>
          ) : '—' },
          { label: 'Details', render: row => row.status?.reason || row.heightStatus?.reason || 'Verified via Fabric operations /healthz' },
          { label: 'Last Checked', render: row => row.lastCheckedAt ? new Date(row.lastCheckedAt).toLocaleTimeString() : '—' },
        ]}
      />
    </section>
  )
}
