// My Timeline — the patient's DID, every document recorded against it, and
// the history of their disease code.

import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Card, Alert, Spinner } from '../components/ui'
import PatientTimeline from '../components/PatientTimeline'
import DiseaseCodeHistory, { CodeStatusPill } from '../components/DiseaseCodeHistory'

export default function TimelinePage() {
  const { api } = useAuth()
  const [code, setCode] = useState({ status: 'loading', record: null })

  useEffect(() => {
    let cancelled = false
    api().get('/timeline/code')
      .then(res => { if (!cancelled) setCode({ status: 'ready', record: res.data.data }) })
      .catch(() => { if (!cancelled) setCode({ status: 'error', record: null }) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Your record on the ledger</p>
        <h1 className="section-heading">My Timeline</h1>
        <p className="text-sm text-slate-500">Every document created for you, in order, under your single identifier. Open an entry to read the document.</p>
      </div>

      <Card className="p-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Disease code</p>
        {code.status === 'loading' && <div className="flex justify-center py-4"><Spinner /></div>}
        {code.status === 'error' && <Alert type="error">Your disease code history could not be loaded. Refresh the page to try again.</Alert>}
        {code.status === 'ready' && (
          <div className="space-y-3">
            {code.record.currentCode ? (
              <p className="text-sm text-slate-800 dark:text-slate-200 flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold">{code.record.currentCode}</span> {code.record.currentName}
                <CodeStatusPill status={code.record.status} />
              </p>
            ) : null}
            {code.record.status === 'PROVISIONAL' && (
              <p className="text-xs text-slate-500">A provisional code is assigned from the symptoms you reported. It is not a diagnosis; your doctor confirms or changes it.</p>
            )}
            <DiseaseCodeHistory record={code.record} showAi={false} />
          </div>
        )}
      </Card>

      <Card className="p-5">
        <PatientTimeline
          loadTimeline={async () => (await api().get('/timeline')).data.data}
          loadDocument={async (seq) => (await api().get(`/timeline/${seq}`)).data.data} />
      </Card>
    </div>
  )
}
