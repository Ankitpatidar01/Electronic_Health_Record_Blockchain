// Explorer — latest blocks, the transactions in a block, and one transaction's
// detail, read from the dashboard's Fabric block listener.

import React, { useCallback, useEffect, useState } from 'react'
import { Boxes, ChevronRight, RefreshCw, X, CheckCircle2, XCircle } from 'lucide-react'
import { fetchApi } from '../services/api'

const ORG_LABELS = { HospitalMSP: 'Hospital', DiagnosticsMSP: 'Diagnostics lab', ProviderMSP: 'Insurance provider' }
const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' }) : '—')
const short = (h, k = 10) => (h && h.length > 2 * k ? `${h.slice(0, k)}…${h.slice(-k)}` : h || '—')
const bytes = (v) => (v === null || v === undefined ? '—' : v < 1024 ? `${v} B` : v < 1048576 ? `${(v / 1024).toFixed(1)} KB` : `${(v / 1048576).toFixed(2)} MB`)
const spaced = (name) => String(name || '').replace(/([a-z])([A-Z])/g, '$1 $2')

function Validity({ valid, reason }) {
  return valid
    ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold"><CheckCircle2 size={13} /> Valid</span>
    : <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-semibold"><XCircle size={13} /> Invalid{reason ? ` · ${String(reason).replace(/_/g, ' ').toLowerCase()}` : ''}</span>
}

function Field({ label, children, mono }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`text-sm text-slate-900 dark:text-white break-all ${mono ? 'font-mono' : ''}`}>{children}</dd>
    </div>
  )
}

export default function Explorer() {
  const [list, setList] = useState({ status: 'loading', items: [], total: 0, collector: null, error: '' })
  const [selected, setSelected] = useState(null)       // block number
  const [block, setBlock] = useState({ status: 'idle', data: null, error: '' })
  const [tx, setTx] = useState(null)

  const loadList = useCallback(async (quiet = false) => {
    if (!quiet) setList(s => ({ ...s, status: s.items.length ? 'refreshing' : 'loading', error: '' }))
    try {
      const data = await fetchApi('/explorer/blocks?limit=50')
      setList({ status: 'ready', items: data.items, total: data.total, collector: data.collector, error: '' })
    } catch (err) {
      setList(s => ({ ...s, status: 'error', error: err.message || 'Blocks could not be loaded.' }))
    }
  }, [])

  useEffect(() => {
    loadList()
    const timer = setInterval(() => loadList(true), 10000)
    return () => clearInterval(timer)
  }, [loadList])

  const openBlock = async (number) => {
    setSelected(number)
    setTx(null)
    setBlock({ status: 'loading', data: null, error: '' })
    try {
      setBlock({ status: 'ready', data: await fetchApi(`/explorer/blocks/${number}`), error: '' })
    } catch (err) {
      setBlock({ status: 'error', data: null, error: err.message || 'The block could not be loaded.' })
    }
  }

  const connected = list.collector?.status === 'CONNECTED'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Blockchain explorer</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Channel ehrchannel{list.collector?.currentHeight ? ` · height ${list.collector.currentHeight}` : ''} · refreshes every 10 s
          </p>
        </div>
        <button type="button" onClick={() => loadList()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <RefreshCw size={14} className={['loading', 'refreshing'].includes(list.status) ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {list.status === 'error' && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{list.error} <button className="underline ml-1" onClick={() => loadList()}>Try again</button></div>}
      {list.status === 'ready' && !connected && (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The dashboard is not connected to a Fabric peer (status: {list.collector?.status || 'unknown'}), so no blocks can be shown.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <section className="premium-card p-0 overflow-hidden xl:col-span-2">
          <h2 className="px-5 pt-5 text-sm font-bold text-slate-900 dark:text-white">Latest blocks</h2>
          {list.status === 'loading' ? <p className="p-8 text-center text-sm text-slate-500" aria-busy="true">Loading blocks…</p>
            : list.items.length === 0 ? <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No blocks have been collected yet.</p>
            : (
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 max-h-[640px] overflow-y-auto">
                {list.items.map(b => (
                  <li key={b.blockNumber}>
                    <button type="button" onClick={() => openBlock(b.blockNumber)} aria-current={selected === b.blockNumber}
                      className={`w-full flex items-center justify-between gap-3 px-5 py-3 text-left transition-colors ${selected === b.blockNumber ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}>
                      <span className="flex items-center gap-3 min-w-0">
                        <span className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"><Boxes size={16} /></span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-900 dark:text-white">Block {b.blockNumber}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">{when(b.timestamp)}</span>
                        </span>
                      </span>
                      <span className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {b.txCount} tx · {bytes(b.sizeBytes)} <ChevronRight size={14} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <section className="premium-card p-5 xl:col-span-3">
          {selected === null ? <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">Select a block to see its transactions.</p>
            : block.status === 'loading' ? <p className="py-16 text-center text-sm text-slate-500" aria-busy="true">Loading block {selected}…</p>
            : block.status === 'error' ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{block.error} <button className="underline ml-1" onClick={() => openBlock(selected)}>Try again</button></div>
            : (
              <div className="space-y-5">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Block {block.data.blockNumber}</h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Time">{when(block.data.timestamp)}</Field>
                  <Field label="Transactions / size">{block.data.txCount} · {bytes(block.data.sizeBytes)}</Field>
                  <Field label="Block hash" mono><span title={block.data.blockHash}>{short(block.data.blockHash, 16)}</span></Field>
                  <Field label="Previous hash" mono><span title={block.data.previousHash}>{short(block.data.previousHash, 16)}</span></Field>
                  <Field label="Data hash" mono><span title={block.data.dataHash}>{short(block.data.dataHash, 16)}</span></Field>
                  <Field label="Channel">{block.data.channel}</Field>
                </dl>
                <div className="overflow-x-auto">
                  <table className="premium-table w-full text-sm">
                    <thead><tr><th className="text-left">Transaction</th><th className="text-left">Type</th><th className="text-left">Organisation</th><th className="text-left">Time</th><th className="text-left">Validation</th></tr></thead>
                    <tbody>
                      {block.data.transactions.map(t => (
                        <tr key={t.txId} className="cursor-pointer" onClick={() => setTx(t)}>
                          <td><button type="button" className="font-mono text-blue-600 dark:text-cyan-400 hover:underline" title={t.txId} onClick={(e) => { e.stopPropagation(); setTx(t) }}>{short(t.txId, 8)}</button></td>
                          <td>{spaced(t.type)}</td>
                          <td>{ORG_LABELS[t.organization] || t.organization || '—'}</td>
                          <td className="whitespace-nowrap">{when(t.timestamp)}</td>
                          <td><Validity valid={t.valid} reason={t.reason} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {tx && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Transaction detail</h3>
                      <button type="button" aria-label="Close transaction detail" onClick={() => setTx(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                    </div>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2"><Field label="Transaction ID" mono>{tx.txId}</Field></div>
                      <Field label="Type">{spaced(tx.type)}</Field>
                      <Field label="Contract / chaincode">{tx.contract ? `${spaced(tx.contract)} · ${tx.chaincode}` : '—'}</Field>
                      <Field label="Submitted by organisation">{ORG_LABELS[tx.organization] || tx.organization || '—'}</Field>
                      <Field label="Timestamp">{when(tx.timestamp)}</Field>
                      <Field label="Block">{block.data.blockNumber}</Field>
                      <Field label="Validation status"><Validity valid={tx.valid} reason={tx.reason} /> <span className="text-xs text-slate-500">(code {tx.validationCode})</span></Field>
                    </dl>
                  </div>
                )}
              </div>
            )}
        </section>
      </div>
    </div>
  )
}
