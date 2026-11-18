// LabReport — the laboratory report as doctors, lab staff and patients read it.
// Presentational only: the caller supplies the order and a way to open attachments.
// The same file is used by the hospital portal and the patient portal.

import { useState } from 'react'
import { Printer, Paperclip, ShieldCheck, Clock, AlertTriangle, Bot, Loader2 } from 'lucide-react'

export const LAB_STATUS = {
  REQUESTED:        { label: 'Ordered',              tone: 'is-neutral' },
  ACKNOWLEDGED:     { label: 'In progress',          tone: 'is-warn' },
  RESULT_SUBMITTED: { label: 'Awaiting verification', tone: 'is-info' },
  COMPLETED:        { label: 'Awaiting verification', tone: 'is-info' }, // records written before the workflow change
  REJECTED:         { label: 'Returned to bench',    tone: 'is-danger' },
  APPROVED:         { label: 'Completed',            tone: 'is-ok' },
}

export function LabStatusPill({ status }) {
  const s = LAB_STATUS[status] || { label: status || 'Unknown', tone: 'is-neutral' }
  return (
    <span className={`status-pill ${s.tone}`}>
      <span className="status-pill-dot" />
      {s.label}
    </span>
  )
}

const FLAG = {
  NORMAL:   { label: 'Normal',   cls: 'is-ok' },
  LOW:      { label: 'Low',      cls: 'is-danger' },
  HIGH:     { label: 'High',     cls: 'is-danger' },
  ABNORMAL: { label: 'Abnormal', cls: 'is-danger' },
}

export function referenceText(p) {
  if (p.refText) return p.refText
  const lo = p.refLow, hi = p.refHigh
  if (lo != null && hi != null) return `${lo} – ${hi}`
  if (lo != null) return `≥ ${lo}`
  if (hi != null) return `≤ ${hi}`
  return '—'
}

function when(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">{label}</p>
      <p className="text-sm text-slate-900 dark:text-slate-100 break-words">{children || '—'}</p>
    </div>
  )
}

// Reports written before structured results existed stored { name: "value" }.
function parametersOf(order) {
  if (order.report?.parameters?.length) return order.report.parameters
  const legacy = order.results || {}
  return Object.entries(legacy)
    .filter(([k]) => !k.startsWith('ai'))
    .map(([name, value]) => ({ name, value: String(value), unit: '', refLow: null, refHigh: null, refText: '', flag: '' }))
}

/**
 * @param order   lab request: { labRequestId, tests, instructions, status, requestedBy, requestedAt,
 *                acknowledgedBy, submittedBy, submittedAt, approvedBy, approvedAt, rejectionReason, report }
 * @param patient { patientId, name, age, gender }
 * @param openAttachment async (attachment) => void   — omit to hide attachment links
 */
export default function LabReport({ order, patient, openAttachment, facility = 'Diagnostic Laboratory' }) {
  const [opening, setOpening] = useState('')
  const [attachError, setAttachError] = useState('')
  const report = order.report
  const parameters = parametersOf(order)
  const hasResult = parameters.length > 0
  const abnormal = parameters.filter(p => p.flag && p.flag !== 'NORMAL')
  const verified = order.status === 'APPROVED'

  const open = async (att) => {
    setAttachError('')
    setOpening(att.cid)
    try {
      await openAttachment(att)
    } catch (err) {
      setAttachError(err?.message || 'Could not open the attachment')
    } finally {
      setOpening('')
    }
  }

  return (
    <div className="lab-report-print">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .lab-report-print, .lab-report-print * { visibility: visible !important; }
          .lab-report-print { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; background: #fff; color: #000; }
          .lab-report-print .no-print { display: none !important; }
          .lab-report-print table { width: 100%; border-collapse: collapse; }
          .lab-report-print th, .lab-report-print td { border-bottom: 1px solid #ddd; padding: 6px 8px; color: #000 !important; }
        }
      `}</style>

      <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold">{facility}</p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">Laboratory Report</h3>
          <p className="text-xs text-slate-500 font-mono">{order.labRequestId}</p>
        </div>
        <div className="flex items-center gap-2">
          <LabStatusPill status={order.status} />
          {hasResult && (
            <button type="button" onClick={() => window.print()}
              className="no-print obs-btn-ghost !px-3 !py-1.5 !text-xs inline-flex items-center gap-1.5">
              <Printer size={13} /> Print / Save PDF
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
        <Field label="Patient">{patient?.name || patient?.patientId}</Field>
        <Field label="Patient ID">{patient?.patientId}</Field>
        <Field label="Age / Sex">{[patient?.age != null && patient?.age !== '' ? `${patient.age} y` : '', patient?.gender].filter(Boolean).join(' / ')}</Field>
        <Field label="Ordered by">{order.requestedBy}</Field>
        <Field label="Tests">{(order.tests || []).join(', ')}</Field>
        <Field label="Specimen">{report?.specimen}</Field>
        <Field label="Ordered">{when(order.requestedAt)}</Field>
        <Field label="Reported">{when(order.approvedAt || order.submittedAt)}</Field>
      </div>

      {order.instructions && (
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4"><span className="font-medium">Clinical note from doctor:</span> {order.instructions}</p>
      )}

      {!hasResult && (
        <div className="flex items-center gap-2 p-4 rounded-xl border border-slate-200 text-sm text-slate-500">
          <Clock size={15} /> No result has been entered for this order yet.
        </div>
      )}

      {hasResult && !verified && (
        <div role="status" className="flex items-center gap-2 p-3 mb-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm">
          <AlertTriangle size={15} />
          {order.status === 'REJECTED'
            ? `Returned to the bench by ${order.rejectedBy || 'the supervisor'}: ${order.rejectionReason || 'no reason recorded'}`
            : 'Preliminary result — not yet verified by a lab supervisor.'}
        </div>
      )}

      {hasResult && (
        <div className="premium-table-wrap overflow-x-auto">
          <table className="premium-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">Parameter</th>
                <th className="text-right">Result</th>
                <th className="text-left">Unit</th>
                <th className="text-left">Reference range</th>
                <th className="text-left">Flag</th>
              </tr>
            </thead>
            <tbody>
              {parameters.map((p) => {
                const flag = FLAG[p.flag]
                const off = p.flag && p.flag !== 'NORMAL'
                return (
                  <tr key={p.name}>
                    <td className="font-medium">{p.name}</td>
                    <td className={`text-right tabular-nums ${off ? 'font-bold text-red-600' : ''}`}>{p.value}</td>
                    <td>{p.unit || '—'}</td>
                    <td className="tabular-nums">{referenceText(p)}</td>
                    <td>{flag ? <span className={`status-pill ${flag.cls}`}>{flag.label}</span> : <span className="text-slate-400">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasResult && (
        <p className="text-xs text-slate-500 mt-2">
          {abnormal.length === 0
            ? 'All reported parameters with a reference range are within range.'
            : `${abnormal.length} of ${parameters.length} parameter(s) outside the reference range: ${abnormal.map(p => p.name).join(', ')}.`}
        </p>
      )}

      {report?.notes && (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 font-medium mb-1">Laboratory comments</p>
          <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{report.notes}</p>
        </div>
      )}

      {report?.attachments?.length > 0 && (
        <div className="mt-4 no-print">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 font-medium mb-1">Attached files</p>
          <ul className="space-y-1">
            {report.attachments.map(att => (
              <li key={att.cid} className="flex items-center gap-2 text-sm">
                <Paperclip size={13} className="text-slate-400" />
                {openAttachment ? (
                  <button type="button" onClick={() => open(att)} disabled={opening === att.cid}
                    className="text-blue-600 hover:underline inline-flex items-center gap-1 disabled:opacity-60">
                    {opening === att.cid && <Loader2 size={12} className="animate-spin" />}
                    {att.filename}
                  </button>
                ) : <span>{att.filename}</span>}
                <span className="text-xs text-slate-400">{att.size ? `${Math.max(1, Math.round(att.size / 1024))} KB` : ''}</span>
              </li>
            ))}
          </ul>
          {attachError && <p role="alert" className="text-xs text-red-600 mt-1">{attachError}</p>}
        </div>
      )}

      {report?.aiAnalysis && (
        <div className="mt-4 p-3 rounded-xl border border-violet-200 bg-violet-50/60 text-sm no-print">
          <p className="flex items-center gap-1.5 font-semibold text-violet-800 text-xs uppercase tracking-wide">
            <Bot size={13} /> AI cross-check — assistive only, not a diagnosis
          </p>
          {report.aiAnalysis.abnormalities?.length > 0 && (
            <ul className="list-disc ml-5 mt-1 text-slate-700">{report.aiAnalysis.abnormalities.map((a, i) => <li key={i}>{a}</li>)}</ul>
          )}
          {report.aiAnalysis.followups?.length > 0 && (
            <p className="mt-1 text-slate-600"><span className="font-medium">Suggested follow-up:</span> {report.aiAnalysis.followups.join('; ')}</p>
          )}
          {!report.aiAnalysis.abnormalities?.length && !report.aiAnalysis.followups?.length && (
            <p className="mt-1 text-slate-600">No abnormality flagged.</p>
          )}
        </div>
      )}

      {hasResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-200">
          <Field label="Sample accepted by">{order.acknowledgedBy ? `${order.acknowledgedBy} · ${when(order.acknowledgedAt)}` : ''}</Field>
          <Field label="Results entered by">{order.submittedBy ? `${order.submittedBy} · ${when(order.submittedAt)}` : ''}</Field>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">Verified and signed by</p>
            {verified ? (
              <p className="text-sm text-emerald-700 font-medium flex items-center gap-1.5">
                <ShieldCheck size={14} /> {order.approvedBy} · {when(order.approvedAt)}
              </p>
            ) : <p className="text-sm text-slate-500">Pending</p>}
          </div>
        </div>
      )}

      {(order.resultsHash || report?.resultsHash) && (
        <p className="text-[10px] text-slate-400 font-mono mt-3 break-all">
          Result fingerprint (SHA-256, recorded on the ledger): {order.resultsHash || report.resultsHash}
        </p>
      )}
    </div>
  )
}
