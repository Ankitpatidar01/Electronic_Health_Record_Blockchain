// PatientTimeline — one patient's DID and every document recorded against it,
// in order. Each entry is a ledger record (CID, type, who, organisation, when);
// opening an entry fetches the document stored at that CID.
// Used by the hospital portal (doctor) and the patient portal.

import { useEffect, useState } from 'react'
import {
  Fingerprint, FileText, Stethoscope, Pill, FlaskConical, HeartPulse, ClipboardList,
  UserPlus, Bot, ChevronDown, ChevronUp, Copy, Check, Loader2, RefreshCw, CircleDot,
} from 'lucide-react'

const TYPES = {
  REGISTRATION:        { label: 'Registration',            icon: UserPlus,      tone: 'is-info' },
  SYMPTOM_ANALYSIS:    { label: 'Symptoms & AI cross-reference', icon: Bot,      tone: 'is-violet' },
  VISIT_OPENED:        { label: 'Visit opened',            icon: ClipboardList, tone: 'is-neutral' },
  ASSIGNMENT:          { label: 'Staff assigned',          icon: ClipboardList, tone: 'is-neutral' },
  CONSULTATION:        { label: 'Consultation',            icon: Stethoscope,   tone: 'is-info' },
  PRESCRIPTION:        { label: 'Prescription',            icon: Pill,          tone: 'is-ok' },
  VITALS:              { label: 'Vitals recorded',         icon: HeartPulse,    tone: 'is-violet' },
  CARE_NOTE:           { label: 'Nursing note',            icon: FileText,      tone: 'is-violet' },
  FORWARD:             { label: 'Handover',                icon: ClipboardList, tone: 'is-neutral' },
  LAB_ORDER:           { label: 'Lab test ordered',        icon: FlaskConical,  tone: 'is-warn' },
  LAB_ACCEPTED:        { label: 'Lab accepted the order',  icon: FlaskConical,  tone: 'is-warn' },
  LAB_RESULT:          { label: 'Lab result entered',      icon: FlaskConical,  tone: 'is-info' },
  LAB_RESULT_RETURNED: { label: 'Lab result returned to bench', icon: FlaskConical, tone: 'is-danger' },
  LAB_RESULT_VERIFIED: { label: 'Lab result verified',     icon: FlaskConical,  tone: 'is-ok' },
  DISPENSE:            { label: 'Medication dispensed',    icon: Pill,          tone: 'is-ok' },
  VISIT_FINALIZED:     { label: 'Visit finalized',         icon: Stethoscope,   tone: 'is-ok' },
  RECORD_FINALIZED:    { label: 'Record finalized',        icon: FileText,      tone: 'is-ok' },
  DISCHARGE:           { label: 'Discharge',               icon: FileText,      tone: 'is-neutral' },
  CLAIM:               { label: 'Insurance claim',         icon: FileText,      tone: 'is-neutral' },
  EHR_UPDATE:          { label: 'Health record updated',   icon: FileText,      tone: 'is-info' },
  VISIT_UPDATE:        { label: 'Visit updated',           icon: FileText,      tone: 'is-neutral' },
  DOCUMENT:            { label: 'Document',                icon: FileText,      tone: 'is-neutral' },
  DIGILOCKER_DOCUMENT: { label: 'DigiLocker document',     icon: FileText,      tone: 'is-neutral' },
  FHIR_BUNDLE:         { label: 'FHIR record',             icon: FileText,      tone: 'is-neutral' },
}
const ORGS = { HospitalMSP: 'Hospital', DiagnosticsMSP: 'Diagnostics lab', ProviderMSP: 'Insurance provider' }

function when(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function humanise(key) {
  return String(key).replace(/^_+/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')
    .replace(/\bcid\b/i, 'CID').replace(/^./, c => c.toUpperCase())
}

const isEmpty = (v) => v === null || v === undefined || v === '' ||
  (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)

// Renders any stored document as labelled fields — never as raw JSON.
function Value({ value, depth = 0 }) {
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>
  if (typeof value === 'number') return <span className="tabular-nums">{value}</span>
  if (typeof value === 'string') {
    const looksDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
    return <span className="break-words whitespace-pre-wrap">{looksDate ? when(value) : value}</span>
  }
  if (Array.isArray(value)) {
    if (value.every(v => typeof v !== 'object' || v === null)) return <span className="break-words">{value.join(', ')}</span>
    return (
      <ol className="space-y-2 list-decimal ml-4">
        {value.map((v, i) => <li key={i}><Value value={v} depth={depth + 1} /></li>)}
      </ol>
    )
  }
  const rows = Object.entries(value).filter(([, v]) => !isEmpty(v))
  if (rows.length === 0) return <span className="text-slate-400">—</span>
  return (
    <dl className={`grid grid-cols-1 gap-x-4 gap-y-1.5 ${depth === 0 ? 'sm:grid-cols-[11rem_1fr]' : 'sm:grid-cols-[9rem_1fr] pl-3 border-l border-slate-200'}`}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-xs font-medium text-slate-500 pt-0.5">{humanise(k)}</dt>
          <dd className="text-sm text-slate-800 dark:text-slate-200 min-w-0"><Value value={v} depth={depth + 1} /></dd>
        </div>
      ))}
    </dl>
  )
}

function CopyButton({ text, label }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    } catch { /* clipboard unavailable: the value is visible and can be selected */ }
  }
  return (
    <button type="button" onClick={copy} aria-label={`Copy ${label}`} className="text-slate-400 hover:text-slate-600 align-middle ml-1">
      {done ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
    </button>
  )
}

function Entry({ entry, loadDocument }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState({ status: 'idle', document: null, error: '' })
  const meta = TYPES[entry.type] || { label: humanise(entry.type.toLowerCase()), icon: CircleDot, tone: 'is-neutral' }
  const Icon = meta.icon

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && state.status === 'idle') {
      setState({ status: 'loading', document: null, error: '' })
      try {
        const data = await loadDocument(entry.seq)
        setState({ status: 'ready', document: data.document, error: '' })
      } catch (err) {
        setState({ status: 'error', document: null, error: err?.response?.data?.error || 'The document could not be loaded. Try again.' })
      }
    }
  }

  return (
    <li className="relative pl-10">
      <span className="absolute left-0 top-1 w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 flex items-center justify-center">
        <Icon size={13} className="text-slate-500" />
      </span>
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button type="button" onClick={toggle} aria-expanded={open}
          className="w-full flex flex-wrap items-center justify-between gap-2 p-3 text-left hover:bg-slate-50 transition-colors">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              <span className="text-slate-400 font-normal mr-1.5">#{entry.seq}</span>{meta.label}
            </p>
            <p className="text-xs text-slate-500">
              {when(entry.timestamp)} · {entry.userId || 'unknown'}{entry.mspId ? ` · ${ORGS[entry.mspId] || entry.mspId}` : ''}
              {entry.ref ? ` · ${entry.ref}` : ''}
            </p>
          </div>
          <span className="flex items-center gap-2">
            <span className={`status-pill ${meta.tone}`}>{entry.type.replace(/_/g, ' ').toLowerCase()}</span>
            {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </span>
        </button>
        {open && (
          <div className="border-t border-slate-100 p-3 space-y-3">
            <p className="text-[11px] text-slate-500 font-mono break-all">
              CID {entry.cid}<CopyButton text={entry.cid} label="CID" />
              <span className="mx-2 text-slate-300">|</span>
              Tx {entry.txId}<CopyButton text={entry.txId} label="transaction ID" />
            </p>
            {state.status === 'loading' && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={14} className="animate-spin" /> Fetching document from IPFS…</p>}
            {state.status === 'error' && (
              <p role="alert" className="text-sm text-red-600">
                {state.error} <button type="button" className="underline" onClick={() => { setState({ status: 'idle', document: null, error: '' }); setOpen(false) }}>Close</button>
              </p>
            )}
            {state.status === 'ready' && (isEmpty(state.document)
              ? <p className="text-sm text-slate-500">This document is empty.</p>
              : <Value value={state.document} />)}
          </div>
        )}
      </div>
    </li>
  )
}

/**
 * @param loadTimeline  async () => { did, patientId, createdAt, entryCount, entries: [...] }
 * @param loadDocument  async (seq) => { entry, document }
 */
export default function PatientTimeline({ loadTimeline, loadDocument }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })
  const [newestFirst, setNewestFirst] = useState(true)

  const load = async () => {
    setState(s => ({ ...s, status: 'loading', error: '' }))
    try {
      setState({ status: 'ready', data: await loadTimeline(), error: '' })
    } catch (err) {
      setState({ status: 'error', data: null, error: err?.response?.data?.error || 'The timeline could not be loaded.' })
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  if (state.status === 'loading') {
    return <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center"><Loader2 size={16} className="animate-spin" /> Loading timeline…</div>
  }
  if (state.status === 'error') {
    return (
      <div role="alert" className="p-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800">
        {state.error} <button type="button" className="underline ml-1" onClick={load}>Retry</button>
      </div>
    )
  }

  const { data } = state
  const entries = newestFirst ? [...data.entries].reverse() : data.entries

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 font-medium flex items-center gap-1.5"><Fingerprint size={12} /> Decentralised identifier (one per patient)</p>
          <p className="font-mono text-sm text-slate-900 dark:text-slate-100 break-all">{data.did}<CopyButton text={data.did} label="DID" /></p>
          <p className="text-xs text-slate-500 mt-0.5">Created {when(data.createdAt)} by {data.createdBy} · {data.entryCount} document{data.entryCount === 1 ? '' : 's'} on the ledger</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setNewestFirst(v => !v)} className="obs-btn-ghost !px-3 !py-1.5 !text-xs">
            {newestFirst ? 'Newest first' : 'Oldest first'}
          </button>
          <button type="button" onClick={load} aria-label="Refresh timeline" className="obs-btn-ghost !px-3 !py-1.5 !text-xs inline-flex items-center gap-1.5"><RefreshCw size={12} /> Refresh</button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">No documents have been recorded for this patient yet.</p>
      ) : (
        <ol className="space-y-3 relative before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
          {entries.map(e => <Entry key={e.seq} entry={e} loadDocument={loadDocument} />)}
        </ol>
      )}
    </div>
  )
}
