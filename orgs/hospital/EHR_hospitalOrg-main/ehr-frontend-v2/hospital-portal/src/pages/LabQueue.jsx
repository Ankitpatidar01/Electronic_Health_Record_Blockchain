// Lab portal — the diagnostic laboratory's worklist.
//
//   Reception   accepts the order and sample          (REQUESTED → ACKNOWLEDGED)
//   Technician  enters results                        (→ RESULT_SUBMITTED)
//   Supervisor  verifies and signs, or sends it back  (→ APPROVED | REJECTED)
//
// The person who entered a result cannot verify it; the ledger enforces that.

import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  FlaskConical, RefreshCw, Search, Plus, Trash2, Paperclip, ClipboardCheck,
  TestTube2, FileText, ShieldCheck, Undo2, Bot, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Card, Button, Modal, Alert, EmptyState, Spinner } from '../components/ui'
import LabReport, { LabStatusPill, LAB_STATUS, referenceText } from '../components/LabReport'
import { analyzeReportWithAI } from '../utils/api'

const RECEPTION   = ['labreceptionist', 'labadmin']
const BENCH       = ['labtechnician', 'radiologist', 'labadmin']
const SUPERVISORS = ['labsupervisor', 'labadmin']
const FILTERS     = ['MINE', 'ALL', 'REQUESTED', 'ACKNOWLEDGED', 'RESULT_SUBMITTED', 'REJECTED', 'APPROVED']
const NUMERIC     = /^-?\d+(\.\d+)?$/
const MAX_FILE    = 3 * 1024 * 1024
const FILE_TYPES  = ['application/pdf', 'image/png', 'image/jpeg']

// Which statuses need action from this role.
function worklistStatuses(role) {
  const s = []
  if (RECEPTION.includes(role))   s.push('REQUESTED')
  if (BENCH.includes(role))       s.push('ACKNOWLEDGED', 'REJECTED')
  if (SUPERVISORS.includes(role)) s.push('RESULT_SUBMITTED')
  return s
}

function errorText(err, fallback) {
  if (err?.response?.data?.error) return err.response.data.error
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.'
  if (!err?.response) return 'The lab service is not reachable. Check your connection and try again.'
  return fallback
}

function when(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function previewFlag(row) {
  const lo = row.refLow === '' ? null : Number(row.refLow)
  const hi = row.refHigh === '' ? null : Number(row.refHigh)
  if (!NUMERIC.test(row.value.trim()) || (lo === null && hi === null)) return ''
  const n = Number(row.value)
  if (lo !== null && n < lo) return 'LOW'
  if (hi !== null && n > hi) return 'HIGH'
  return 'NORMAL'
}

const blankRow = (name = '') => ({ name, value: '', unit: '', refLow: '', refHigh: '', refText: '', flag: '' })

export default function LabQueue() {
  const { user, token } = useAuth()
  const role = user?.role

  const api = useMemo(() => {
    const client = axios.create({ baseURL: '/api/hospital/ext', timeout: 60000 })
    if (token) client.defaults.headers.common.Authorization = `Bearer ${token}`
    return client
  }, [token])

  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [notice, setNotice]   = useState('')
  const [filter, setFilter]   = useState('MINE')
  const [search, setSearch]   = useState('')
  const [busyId, setBusyId]   = useState('')
  const [entry, setEntry]     = useState(null)   // order being resulted
  const [viewing, setViewing] = useState(null)   // order whose report is open

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/lab/requests')
      setOrders(res.data.data || [])
    } catch (err) {
      setError(errorText(err, 'Could not load the lab worklist.'))
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => { load() }, [load])

  const mine = worklistStatuses(role)
  const counts = useMemo(() => {
    const c = { ALL: orders.length, MINE: 0 }
    for (const o of orders) {
      c[o.status] = (c[o.status] || 0) + 1
      if (mine.includes(o.status)) c.MINE += 1
    }
    return c
  }, [orders, mine])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter(o => {
      if (filter === 'MINE' && !mine.includes(o.status)) return false
      if (filter !== 'MINE' && filter !== 'ALL' && o.status !== filter) return false
      if (!q) return true
      return [o.labRequestId, o.patientId, o.patient?.name, o.requestedBy, ...(o.tests || [])]
        .some(v => String(v || '').toLowerCase().includes(q))
    })
  }, [orders, filter, search, mine])

  const acknowledge = async (order) => {
    setBusyId(order.labRequestId); setError(''); setNotice('')
    try {
      await api.put(`/lab/visits/${order.visitId}/request/${order.labRequestId}/acknowledge`)
      setNotice(`Order ${order.labRequestId} accepted. It is now on the bench worklist.`)
      await load()
    } catch (err) {
      setError(errorText(err, 'Could not accept the order.'))
    } finally {
      setBusyId('')
    }
  }

  const openAttachment = (order) => async (att) => {
    const res = await api.get(
      `/lab/visits/${order.visitId}/request/${order.labRequestId}/attachments/${att.cid}`,
      { responseType: 'blob' }
    ).catch((err) => { throw new Error(errorText(err, 'Could not open the attachment.')) })
    const url = URL.createObjectURL(res.data)
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const action = (order) => {
    const busy = busyId === order.labRequestId
    if (order.status === 'REQUESTED' && RECEPTION.includes(role)) {
      return <Button size="sm" loading={busy} onClick={() => acknowledge(order)}><ClipboardCheck size={13} /> Accept order</Button>
    }
    if (['ACKNOWLEDGED', 'REJECTED'].includes(order.status) && BENCH.includes(role)) {
      return <Button size="sm" onClick={() => setEntry(order)}><TestTube2 size={13} /> {order.status === 'REJECTED' ? 'Re-enter results' : 'Enter results'}</Button>
    }
    if (order.status === 'RESULT_SUBMITTED' && SUPERVISORS.includes(role)) {
      return <Button size="sm" variant="success" onClick={() => setViewing(order)}><ShieldCheck size={13} /> Review &amp; sign</Button>
    }
    return <Button size="sm" variant="secondary" onClick={() => setViewing(order)}><FileText size={13} /> View</Button>
  }

  const filterLabel = (f) => (f === 'MINE' ? 'My worklist' : f === 'ALL' ? 'All orders' : LAB_STATUS[f].label)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Diagnostics organisation</p>
          <h1 className="section-heading">Lab worklist</h1>
          <p className="text-sm text-slate-500">Orders from doctors, results entry, verification and release.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {error && <Alert type="error">{error} <button className="underline ml-2" onClick={load}>Retry</button></Alert>}
      {notice && <Alert type="success">{notice}</Alert>}

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filter === f ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {filterLabel(f)} <span className="opacity-70">({counts[f] || 0})</span>
            </button>
          ))}
          <label className="relative ml-auto w-full sm:w-72">
            <span className="sr-only">Search orders</span>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, order ID or test"
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {search && (
              <button type="button" aria-label="Clear search" onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>
            )}
          </label>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : visible.length === 0 ? (
          <EmptyState icon={FlaskConical}
            title={orders.length === 0 ? 'No lab orders yet' : 'Nothing matches'}
            desc={orders.length === 0
              ? 'Orders appear here when a doctor sends a patient for tests.'
              : filter === 'MINE' && !search ? 'Nothing is waiting for you right now.' : 'Try another filter or clear the search.'} />
        ) : (
          <div className="premium-table-wrap overflow-x-auto">
            <table className="premium-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Order</th>
                  <th className="text-left">Patient</th>
                  <th className="text-left">Tests</th>
                  <th className="text-left">Ordered</th>
                  <th className="text-left">Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(o => (
                  <tr key={o.labRequestId}>
                    <td className="font-mono text-xs">{o.labRequestId}</td>
                    <td>
                      <p className="font-medium">{o.patient?.name || o.patientId}</p>
                      <p className="text-xs text-slate-400">{o.patientId}{o.patient?.age != null ? ` · ${o.patient.age} y` : ''}{o.patient?.gender ? ` · ${o.patient.gender}` : ''}</p>
                    </td>
                    <td>
                      <p>{(o.tests || []).join(', ') || '—'}</p>
                      {o.instructions && <p className="text-xs text-slate-400 max-w-xs truncate" title={o.instructions}>{o.instructions}</p>}
                    </td>
                    <td>
                      <p>{when(o.requestedAt)}</p>
                      <p className="text-xs text-slate-400">by {o.requestedBy}</p>
                    </td>
                    <td><LabStatusPill status={o.status} /></td>
                    <td className="text-right whitespace-nowrap">{action(o)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {entry && (
        <ResultEntryModal order={entry} api={api} userRole={role}
          onClose={() => setEntry(null)}
          onDone={async (msg) => { setEntry(null); setNotice(msg); await load() }} />
      )}

      {viewing && (
        <ReviewModal order={viewing} api={api} canSign={SUPERVISORS.includes(role)} currentUser={user?.userId}
          openAttachment={openAttachment(viewing)}
          onClose={() => setViewing(null)}
          onDone={async (msg) => { setViewing(null); setNotice(msg); await load() }} />
      )}
    </div>
  )
}

// ── Result entry ─────────────────────────────────────────────────────────────
function ResultEntryModal({ order, api, onClose, onDone }) {
  const [rows, setRows]         = useState([])
  const [specimen, setSpecimen] = useState(order.report?.specimen || '')
  const [notes, setNotes]       = useState(order.report?.notes || '')
  const [files, setFiles]       = useState(order.report?.attachments || [])
  const [ai, setAi]             = useState(null)
  const [aiBusy, setAiBusy]     = useState(false)
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [touched, setTouched]   = useState(false)

  // Start from the previous entry (a rejected result) or from the test catalog:
  // names, units and reference ranges are filled in; values are always typed.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (order.report?.parameters?.length) {
        setRows(order.report.parameters.map(p => ({
          name: p.name, value: p.value, unit: p.unit || '',
          refLow: p.refLow ?? '', refHigh: p.refHigh ?? '', refText: p.refText || '', flag: p.flag || '',
        })))
        setLoading(false)
        return
      }
      try {
        const res = await api.get('/lab/catalog', { params: { gender: order.patient?.gender || '' } })
        if (cancelled) return
        const catalog = res.data.data || {}
        const byLower = Object.fromEntries(Object.entries(catalog).map(([k, v]) => [k.toLowerCase(), v]))
        const labels  = Object.fromEntries(Object.entries(catalog).map(([k, v]) => [v.label.toLowerCase(), v]))
        const next = []
        let spec = ''
        for (const t of order.tests || []) {
          const def = byLower[t.trim().toLowerCase()] || labels[t.trim().toLowerCase()]
          if (def) {
            spec = spec || def.specimen
            def.parameters.forEach(p => next.push({ ...blankRow(p.name), unit: p.unit, refLow: p.refLow ?? '', refHigh: p.refHigh ?? '' }))
          } else {
            next.push(blankRow(t))
          }
        }
        setRows(next.length ? next : [blankRow()])
        setSpecimen(s => s || spec)
      } catch {
        if (!cancelled) setRows((order.tests || ['']).map(t => blankRow(t)))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [api, order])

  const setRow = (i, patch) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const rowError = (r) => {
    if (!r.name.trim()) return 'Name required'
    if (!r.value.trim()) return 'Value required'
    const ranged = r.refLow !== '' || r.refHigh !== ''
    if (ranged && !NUMERIC.test(r.value.trim())) return 'Must be a number'
    if (r.refLow !== '' && r.refHigh !== '' && Number(r.refLow) > Number(r.refHigh)) return 'Range is reversed'
    return ''
  }
  const duplicate = (() => {
    const seen = new Set()
    for (const r of rows) {
      const k = r.name.trim().toLowerCase()
      if (k && seen.has(k)) return r.name
      seen.add(k)
    }
    return ''
  })()
  const invalid = rows.length === 0 || rows.some(rowError) || Boolean(duplicate)

  const upload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    if (!FILE_TYPES.includes(file.type)) return setError('Only PDF, PNG and JPEG files can be attached.')
    if (file.size > MAX_FILE) return setError('The file is larger than 3 MB.')
    if (files.length >= 5) return setError('At most 5 files can be attached.')
    setUploading(true)
    try {
      const dataBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
        reader.onerror = () => reject(new Error('Could not read the file'))
        reader.readAsDataURL(file)
      })
      const res = await api.post(
        `/lab/visits/${order.visitId}/request/${order.labRequestId}/attachments`,
        { filename: file.name, mimeType: file.type, dataBase64 }
      )
      setFiles(f => [...f, res.data.data])
    } catch (err) {
      setError(errorText(err, 'Could not upload the file.'))
    } finally {
      setUploading(false)
    }
  }

  const crossCheck = async () => {
    setAiBusy(true); setError('')
    try {
      const text = rows.filter(r => r.name && r.value)
        .map(r => `${r.name}: ${r.value} ${r.unit} (reference ${referenceText({ refLow: r.refLow === '' ? null : Number(r.refLow), refHigh: r.refHigh === '' ? null : Number(r.refHigh), refText: r.refText })})`)
        .join('\n')
      const out = await analyzeReportWithAI(text, order.patientId, (order.tests || []).join(', '))
      setAi({
        findings: out.findings || [],
        abnormalities: out.abnormalities_flagged || [],
        followups: out.suggested_followups || [],
        source: 'clinical-ai-agent',
      })
    } catch (err) {
      setAi(null)
      setError('The AI cross-check is unavailable right now. You can still submit the results.')
    } finally {
      setAiBusy(false)
    }
  }

  const submit = async () => {
    setTouched(true)
    if (invalid) return
    setSaving(true); setError('')
    try {
      await api.put(`/lab/visits/${order.visitId}/request/${order.labRequestId}/submit`, {
        parameters: rows.map(r => ({
          name: r.name.trim(), value: r.value.trim(), unit: r.unit.trim(),
          refLow: r.refLow === '' ? null : Number(r.refLow),
          refHigh: r.refHigh === '' ? null : Number(r.refHigh),
          refText: r.refText.trim(), flag: r.flag,
        })),
        specimen, notes, attachments: files, aiAnalysis: ai,
      })
      onDone(`Results for ${order.labRequestId} submitted. They are waiting for supervisor verification.`)
    } catch (err) {
      setError(errorText(err, 'Could not submit the results.'))
      setSaving(false)
    }
  }

  const cell = 'w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <Modal open onClose={saving ? () => {} : onClose} size="xl" title={`Enter results · ${order.labRequestId}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><p className="text-xs text-slate-400">Patient</p><p className="font-medium">{order.patient?.name || order.patientId}</p></div>
          <div><p className="text-xs text-slate-400">Age / Sex</p><p>{[order.patient?.age != null ? `${order.patient.age} y` : '', order.patient?.gender].filter(Boolean).join(' / ') || '—'}</p></div>
          <div><p className="text-xs text-slate-400">Tests ordered</p><p>{(order.tests || []).join(', ')}</p></div>
          <div><p className="text-xs text-slate-400">Ordered by</p><p>{order.requestedBy}</p></div>
        </div>
        {order.instructions && <p className="text-sm text-slate-600"><span className="font-medium">Doctor's note:</span> {order.instructions}</p>}
        {order.status === 'REJECTED' && (
          <Alert type="warning">Returned by {order.rejectedBy || 'the supervisor'}: {order.rejectionReason || 'no reason recorded'}</Alert>
        )}
        {error && <Alert type="error">{error}</Alert>}

        {loading ? <div className="flex justify-center py-10"><Spinner /></div> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                    <th className="pb-2 pr-2 min-w-[11rem]">Parameter</th>
                    <th className="pb-2 pr-2 w-28">Result</th>
                    <th className="pb-2 pr-2 w-24">Unit</th>
                    <th className="pb-2 pr-2 w-20">Ref. low</th>
                    <th className="pb-2 pr-2 w-20">Ref. high</th>
                    <th className="pb-2 pr-2 w-28">Flag</th>
                    <th className="pb-2 w-8"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const err = touched ? rowError(r) : ''
                    const auto = previewFlag(r)
                    const ranged = r.refLow !== '' || r.refHigh !== ''
                    return (
                      <tr key={i} className="align-top">
                        <td className="pr-2 pb-2"><input aria-label="Parameter name" className={cell} value={r.name} onChange={e => setRow(i, { name: e.target.value })} /></td>
                        <td className="pr-2 pb-2">
                          <input aria-label={`Result for ${r.name || 'parameter'}`} aria-invalid={Boolean(err)} inputMode={ranged ? 'decimal' : 'text'}
                            className={`${cell} ${err ? 'border-red-400' : ''} ${auto && auto !== 'NORMAL' ? 'font-bold text-red-600' : ''}`}
                            value={r.value} onChange={e => setRow(i, { value: e.target.value })} />
                          {err && <p className="text-[11px] text-red-600 mt-0.5">{err}</p>}
                        </td>
                        <td className="pr-2 pb-2"><input aria-label="Unit" className={cell} value={r.unit} onChange={e => setRow(i, { unit: e.target.value })} /></td>
                        <td className="pr-2 pb-2"><input aria-label="Reference low" type="number" step="any" className={cell} value={r.refLow} onChange={e => setRow(i, { refLow: e.target.value })} /></td>
                        <td className="pr-2 pb-2"><input aria-label="Reference high" type="number" step="any" className={cell} value={r.refHigh} onChange={e => setRow(i, { refHigh: e.target.value })} /></td>
                        <td className="pr-2 pb-2">
                          {ranged ? (
                            auto ? <span className={`status-pill ${auto === 'NORMAL' ? 'is-ok' : 'is-danger'}`}>{auto === 'NORMAL' ? 'Normal' : auto === 'LOW' ? 'Low' : 'High'}</span>
                                 : <span className="text-xs text-slate-400">auto</span>
                          ) : (
                            <select aria-label="Flag" className={cell} value={r.flag} onChange={e => setRow(i, { flag: e.target.value })}>
                              <option value="">Not set</option>
                              <option value="NORMAL">Normal</option>
                              <option value="ABNORMAL">Abnormal</option>
                            </select>
                          )}
                        </td>
                        <td className="pb-2">
                          <button type="button" aria-label={`Remove ${r.name || 'row'}`} onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}
                            className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {touched && duplicate && <p className="text-xs text-red-600">"{duplicate}" is listed more than once.</p>}
            {touched && rows.length === 0 && <p className="text-xs text-red-600">Add at least one parameter.</p>}
            <Button size="sm" variant="secondary" onClick={() => setRows(rs => [...rs, blankRow()])}><Plus size={13} /> Add parameter</Button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Specimen</span>
                <input className={cell} value={specimen} maxLength={120} onChange={e => setSpecimen(e.target.value)} placeholder="e.g. Whole blood (EDTA)" />
              </label>
              <div className="text-sm">
                <p className="font-medium text-slate-700 mb-1">Attached files <span className="font-normal text-slate-400">(PDF, PNG, JPEG · up to 3 MB · max 5)</span></p>
                <ul className="space-y-1 mb-2">
                  {files.map(f => (
                    <li key={f.cid} className="flex items-center gap-2">
                      <Paperclip size={13} className="text-slate-400" /> <span className="truncate">{f.filename}</span>
                      <button type="button" aria-label={`Remove ${f.filename}`} onClick={() => setFiles(fs => fs.filter(x => x.cid !== f.cid))}
                        className="text-slate-400 hover:text-red-600"><X size={13} /></button>
                    </li>
                  ))}
                </ul>
                <label className={`obs-btn-ghost !px-3 !py-1.5 !text-xs inline-flex items-center gap-1.5 cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                  <Paperclip size={13} /> {uploading ? 'Uploading…' : 'Attach file'}
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" onChange={upload} disabled={uploading} />
                </label>
              </div>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Laboratory comments</span>
              <textarea rows={3} maxLength={2000} className={cell} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Interpretation, sample quality, method notes" />
            </label>

            <div className="p-3 rounded-xl border border-violet-200 bg-violet-50/60 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 font-semibold text-violet-800 text-xs uppercase tracking-wide">
                  <Bot size={13} /> AI cross-check — assistive only, not a diagnosis
                </p>
                <Button size="sm" variant="secondary" loading={aiBusy} disabled={rows.every(r => !r.value.trim())} onClick={crossCheck}>Run</Button>
              </div>
              {ai && (
                <div className="mt-2 text-slate-700">
                  {ai.abnormalities.length ? <ul className="list-disc ml-5">{ai.abnormalities.map((a, i) => <li key={i}>{a}</li>)}</ul> : <p>No abnormality flagged.</p>}
                  {ai.followups.length > 0 && <p className="mt-1"><span className="font-medium">Suggested follow-up:</span> {ai.followups.join('; ')}</p>}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} loading={saving} disabled={loading || uploading}>Submit for verification</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Report view, verification and sign-off ───────────────────────────────────
function ReviewModal({ order, api, canSign, currentUser, openAttachment, onClose, onDone }) {
  const [busy, setBusy]         = useState('')
  const [error, setError]       = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason]     = useState('')
  const awaiting = order.status === 'RESULT_SUBMITTED'
  const ownResult = order.submittedBy === currentUser

  const approve = async () => {
    setBusy('approve'); setError('')
    try {
      await api.put(`/lab/visits/${order.visitId}/request/${order.labRequestId}/approve`, { resultsHash: order.resultsHash })
      onDone(`Report ${order.labRequestId} verified and released to ${order.assignedDoctor || 'the doctor'} and the patient.`)
    } catch (err) {
      setError(errorText(err, 'Could not approve the report.'))
      setBusy('')
    }
  }

  const reject = async () => {
    if (reason.trim().length < 3) return setError('Give a reason of at least 3 characters.')
    setBusy('reject'); setError('')
    try {
      await api.put(`/lab/visits/${order.visitId}/request/${order.labRequestId}/reject`, { reason: reason.trim() })
      onDone(`Report ${order.labRequestId} returned to the bench.`)
    } catch (err) {
      setError(errorText(err, 'Could not return the report.'))
      setBusy('')
    }
  }

  return (
    <Modal open onClose={busy ? () => {} : onClose} size="xl" title={`Lab report · ${order.labRequestId}`}>
      <LabReport order={order} patient={order.patient} openAttachment={openAttachment} />

      {error && <div className="mt-4"><Alert type="error">{error}</Alert></div>}

      {canSign && awaiting && (
        <div className="mt-5 pt-4 border-t border-slate-200 no-print">
          {ownResult ? (
            <Alert type="warning">You entered these results, so another supervisor must verify them.</Alert>
          ) : rejecting ? (
            <div className="space-y-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Reason for returning to the bench</span>
                <textarea rows={2} maxLength={500} value={reason} onChange={e => setReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. haemolysed sample, repeat required" />
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => { setRejecting(false); setError('') }} disabled={Boolean(busy)}>Back</Button>
                <Button variant="danger" size="md" className="px-4 py-2.5 text-sm" loading={busy === 'reject'} onClick={reject}><Undo2 size={14} /> Return to bench</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600 max-w-xl">
                By verifying, you sign this report with your laboratory identity. It is then released to the ordering doctor and the patient.
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setRejecting(true)} disabled={Boolean(busy)}><Undo2 size={14} /> Return to bench</Button>
                <Button variant="success" size="md" className="px-4 py-2.5 text-sm" loading={busy === 'approve'} onClick={approve}><ShieldCheck size={14} /> Verify &amp; sign</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
