// DiseaseCodeHistory — the full ICD-10 code history of a patient: every
// provisional assignment, change and confirmation, oldest first.
// Used by the hospital portal (doctor) and the patient portal.

const ACTIONS = {
  PROVISIONAL: { label: 'Provisional', tone: 'is-warn' },
  CHANGED:     { label: 'Changed by doctor', tone: 'is-info' },
  CONFIRMED:   { label: 'Confirmed by doctor', tone: 'is-ok' },
}

function when(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function CodeStatusPill({ status }) {
  if (!status) return <span className="status-pill is-neutral">Not assigned</span>
  return <span className={`status-pill ${status === 'CONFIRMED' ? 'is-ok' : 'is-warn'}`}>{status === 'CONFIRMED' ? 'Confirmed' : 'Provisional'}</span>
}

export default function DiseaseCodeHistory({ record, showAi = true }) {
  const history = record?.history || []
  if (history.length === 0) {
    return <p className="text-sm text-slate-500">No disease code has been recorded for this patient yet.</p>
  }
  return (
    <div className="premium-table-wrap overflow-x-auto">
      <table className="premium-table w-full text-sm">
        <thead>
          <tr>
            <th className="text-left">#</th>
            <th className="text-left">When</th>
            <th className="text-left">Step</th>
            <th className="text-left">Old code</th>
            <th className="text-left">New code</th>
            <th className="text-left">By</th>
            <th className="text-left">Reason</th>
            {showAi && <th className="text-left">AI suggested</th>}
          </tr>
        </thead>
        <tbody>
          {history.map(h => {
            const a = ACTIONS[h.action] || { label: h.action, tone: 'is-neutral' }
            return (
              <tr key={h.seq}>
                <td className="tabular-nums">{h.seq}</td>
                <td className="whitespace-nowrap">{when(h.timestamp)}</td>
                <td><span className={`status-pill ${a.tone}`}>{a.label}</span></td>
                <td className="font-mono">{h.oldCode || '—'}</td>
                <td><span className="font-mono font-semibold">{h.newCode}</span>{h.name ? <span className="block text-xs text-slate-500">{h.name}</span> : null}</td>
                <td>{h.by}{h.visitId ? <span className="block text-xs text-slate-400">{h.visitId}</span> : null}</td>
                <td className="max-w-xs">{h.reason}</td>
                {showAi && (
                  <td>
                    {(h.aiSuggestedCodes || []).length ? <span className="font-mono">{h.aiSuggestedCodes.join(', ')}</span> : <span className="text-slate-400">—</span>}
                    {h.action !== 'PROVISIONAL' && (h.aiSuggestedCodes || []).length > 0 && (
                      <span className={`block text-xs ${h.matchesAiSuggestion ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {h.matchesAiSuggestion ? 'Doctor agrees with AI' : 'Doctor differs from AI'}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
