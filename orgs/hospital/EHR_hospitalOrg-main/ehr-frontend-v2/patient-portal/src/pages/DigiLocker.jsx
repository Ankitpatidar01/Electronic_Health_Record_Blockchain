import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Anchor,
  BadgeCheck,
  Download,
  FileText,
  FolderLock,
  Link2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Unlink,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { errorMessage, formatDate, formatDateTime } from '../utils/api'
import { Button, Modal, Spinner } from '../components/ui'

const DOC_TYPE = {
  LAB_REPORT:        { label: 'Lab report',        tone: 'is-info' },
  PRESCRIPTION:      { label: 'Prescription',      tone: 'is-violet' },
  DISCHARGE_SUMMARY: { label: 'Discharge summary', tone: 'is-warn' },
  IMMUNIZATION:      { label: 'Immunization',      tone: 'is-ok' },
  HEALTH_ID:         { label: 'Health ID',         tone: 'is-info' },
  INSURANCE:         { label: 'Insurance',         tone: 'is-neutral' },
  OTHER:             { label: 'Other',             tone: 'is-neutral' },
}

const RETURN_NOTICE = {
  linked: { type: 'ok', text: 'DigiLocker is linked. Choose the documents you want in your vault.' },
  denied: { type: 'warn', text: 'Linking was cancelled. Nothing was shared.' },
  error:  { type: 'error', text: 'Linking could not be completed. Please try again.' },
}

const short = (value, head = 10, tail = 6) =>
  !value ? '—' : value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`

const formatSize = (bytes) => {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function TypePill({ type }) {
  const info = DOC_TYPE[type] || DOC_TYPE.OTHER
  return <span className={`status-pill ${info.tone}`}>{info.label}</span>
}

function Notice({ notice, onClose }) {
  if (!notice) return null
  const tone = { ok: 'is-ok', warn: 'is-warn', error: 'is-danger' }[notice.type] || 'is-info'
  return (
    <div
      role={notice.type === 'error' ? 'alert' : 'status'}
      className={`dashboard-message ${notice.type === 'error' ? 'is-error' : ''} flex items-start justify-between gap-3`}
    >
      <div className="flex items-start gap-2.5">
        <span className={`status-pill ${tone} mt-0.5 shrink-0`}><span className="status-pill-dot" /></span>
        <span>{notice.text}</span>
      </div>
      <button type="button" onClick={onClose} className="obs-btn-ghost shrink-0">Dismiss</button>
    </div>
  )
}

function Metric({ icon: Icon, label, value, hint }) {
  return (
    <div className="premium-card p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow !mb-0">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-sky-500/15 dark:text-sky-400">
          <Icon size={17} />
        </span>
      </div>
      <div className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{value}</div>
      <p className="obs-muted mt-1 text-xs">{hint}</p>
    </div>
  )
}

function CopyChip({ value, label }) {
  const [copied, setCopied] = useState(false)
  if (!value) return <span className="obs-muted">—</span>
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch { /* clipboard unavailable */ }
  }
  return (
    <button type="button" onClick={copy} className="obs-chip cursor-pointer" title={`${label}: ${value} (click to copy)`}>
      {copied ? 'Copied' : short(value)}
    </button>
  )
}

export default function DigiLockerVault() {
  const { digilocker } = useAuth()
  const [params, setParams] = useSearchParams()

  const [status, setStatus] = useState(null)
  const [statusError, setStatusError] = useState('')
  const [issued, setIssued] = useState([])
  const [issuedError, setIssuedError] = useState('')
  const [ledgerAvailable, setLedgerAvailable] = useState(true)
  const [vault, setVault] = useState([])
  const [vaultError, setVaultError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState({})
  const [notice, setNotice] = useState(null)
  const [verified, setVerified] = useState({})
  const [withdraw, setWithdraw] = useState(null)

  const setBusyFor = (key, value) => setBusy(prev => ({ ...prev, [key]: value }))

  const loadVault = useCallback(async () => {
    try {
      const res = await digilocker().get('/vault')
      setVault(res.data.data || [])
      setVaultError('')
    } catch (err) {
      setVaultError(errorMessage(err, 'The vault could not be loaded.'))
    }
  }, [digilocker])

  const loadIssued = useCallback(async () => {
    try {
      const res = await digilocker().get('/documents')
      setIssued(res.data.data.documents || [])
      setLedgerAvailable(res.data.data.ledgerAvailable !== false)
      setIssuedError('')
    } catch (err) {
      if (err.response?.data?.code === 'NOT_LINKED') {
        setStatus(prev => (prev ? { ...prev, linked: false, account: null } : prev))
        setIssued([])
        setIssuedError('')
      } else {
        setIssuedError(errorMessage(err, 'Your DigiLocker documents could not be loaded.'))
      }
    }
  }, [digilocker])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await digilocker().get('/status')
      const next = res.data.data
      setStatus(next)
      setStatusError('')
      await Promise.all([loadVault(), next.linked ? loadIssued() : Promise.resolve()])
    } catch (err) {
      setStatusError(errorMessage(err, 'The DigiLocker service is not reachable.'))
    } finally {
      setLoading(false)
    }
  }, [digilocker, loadIssued, loadVault])

  useEffect(() => { loadAll() }, [loadAll])

  // Result of the OAuth round-trip arrives as ?digilocker=linked|denied|error
  useEffect(() => {
    const result = params.get('digilocker')
    if (!result) return
    setNotice(RETURN_NOTICE[result] || null)
    const next = new URLSearchParams(params)
    next.delete('digilocker')
    next.delete('reason')
    setParams(next, { replace: true })
  }, [params, setParams])

  const startLink = async () => {
    setBusyFor('link', true)
    try {
      const res = await digilocker().post('/link/start')
      window.location.assign(res.data.data.authorizeUrl)
    } catch (err) {
      setNotice({ type: 'error', text: errorMessage(err, 'Linking could not be started.') })
      setBusyFor('link', false)
    }
  }

  const unlink = async () => {
    setBusyFor('link', true)
    try {
      await digilocker().delete('/link')
      setStatus(prev => ({ ...prev, linked: false, account: null, linkedAt: null }))
      setIssued([])
      setNotice({ type: 'ok', text: 'DigiLocker was unlinked. Documents already in your vault stay anchored.' })
    } catch (err) {
      setNotice({ type: 'error', text: errorMessage(err, 'Unlinking failed.') })
    } finally {
      setBusyFor('link', false)
    }
  }

  const pull = async (doc) => {
    setBusyFor(doc.uri, true)
    try {
      await digilocker().post('/documents/pull', { uri: doc.uri })
      setNotice({ type: 'ok', text: `“${doc.name}” was encrypted, stored on IPFS and anchored on the ledger.` })
      await Promise.all([loadVault(), loadIssued()])
    } catch (err) {
      if (err.response?.data?.code === 'ALREADY_ANCHORED') {
        await Promise.all([loadVault(), loadIssued()])
        setNotice({ type: 'warn', text: `“${doc.name}” is already in your vault.` })
      } else {
        setNotice({ type: 'error', text: errorMessage(err, 'The document could not be anchored.') })
      }
    } finally {
      setBusyFor(doc.uri, false)
    }
  }

  const verify = async (doc) => {
    setBusyFor(`verify:${doc.docId}`, true)
    try {
      const res = await digilocker().get(`/vault/${doc.docId}/verify`)
      setVerified(prev => ({ ...prev, [doc.docId]: { ...res.data.data, at: new Date().toISOString() } }))
    } catch (err) {
      setNotice({ type: 'error', text: errorMessage(err, 'Verification could not be run.') })
    } finally {
      setBusyFor(`verify:${doc.docId}`, false)
    }
  }

  const download = async (doc) => {
    setBusyFor(`download:${doc.docId}`, true)
    try {
      const res = await digilocker().get(`/vault/${doc.docId}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `${doc.name || doc.docId}${res.data.type === 'application/pdf' ? '.pdf' : ''}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (err) {
      let text = errorMessage(err, 'The document could not be downloaded.')
      if (err.response?.data instanceof Blob) {
        try { text = JSON.parse(await err.response.data.text()).error || text } catch { /* keep default */ }
      }
      setNotice({ type: 'error', text })
    } finally {
      setBusyFor(`download:${doc.docId}`, false)
    }
  }

  const confirmWithdraw = async () => {
    const doc = withdraw
    setBusyFor(`withdraw:${doc.docId}`, true)
    try {
      await digilocker().delete(`/vault/${doc.docId}`, { data: { reason: 'Withdrawn by patient' } })
      setWithdraw(null)
      setNotice({ type: 'ok', text: `“${doc.name || doc.docId}” was withdrawn. The ledger keeps the record of the withdrawal.` })
      await Promise.all([loadVault(), status?.linked ? loadIssued() : Promise.resolve()])
    } catch (err) {
      setNotice({ type: 'error', text: errorMessage(err, 'The document could not be withdrawn.') })
    } finally {
      setBusyFor(`withdraw:${doc.docId}`, false)
    }
  }

  const anchoredCount = useMemo(() => vault.filter(doc => doc.status === 'ANCHORED').length, [vault])
  const pending = useMemo(() => issued.filter(doc => !doc.anchored).length, [issued])
  const verifiedCount = Object.values(verified).filter(result => result.verified).length

  if (loading && !status && !statusError) {
    return (
      <div className="flex flex-col items-center justify-center py-24" aria-busy="true">
        <Spinner size="lg" />
        <p className="obs-muted mt-3 text-xs">Loading your DigiLocker vault…</p>
      </div>
    )
  }

  if (statusError) {
    return (
      <div className="premium-card mx-auto max-w-xl p-8 text-center">
        <TriangleAlert className="mx-auto text-amber-500" size={28} />
        <h1 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">DigiLocker vault is unavailable</h1>
        <p className="obs-muted mt-1 text-sm">{statusError}</p>
        <button type="button" onClick={loadAll} className="obs-btn mt-5"><RefreshCw size={14} /> Try again</button>
      </div>
    )
  }

  const sandbox = status?.mode === 'sandbox'

  return (
    <div className="space-y-6">
      <section className="premium-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <p className="eyebrow">Document vault</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white md:text-3xl">DigiLocker Vault</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Bring certified lab reports and prescriptions from your DigiLocker into your health record. Each document is
              encrypted before it leaves this service, stored on IPFS, and its fingerprint is anchored on the Fabric ledger so
              any later change can be detected.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <span className={`status-pill ${status.linked ? 'is-ok' : 'is-neutral'}`}>
              <span className="status-pill-dot" />
              {status.linked ? `Linked · ${status.account?.maskedId || 'account'}` : 'Not linked'}
            </span>
            {status.linked ? (
              <button type="button" onClick={unlink} disabled={busy.link} className="obs-btn-ghost is-danger">
                <Unlink size={14} /> {busy.link ? 'Unlinking…' : 'Unlink DigiLocker'}
              </button>
            ) : (
              <button type="button" onClick={startLink} disabled={busy.link} className="obs-btn">
                <Link2 size={15} /> {busy.link ? 'Opening consent…' : 'Link DigiLocker'}
              </button>
            )}
          </div>
        </div>
        {sandbox && (
          <div className="dashboard-message is-error mt-5 flex items-start gap-2.5">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>
              <strong>Sandbox mode.</strong> This deployment uses a built-in DigiLocker simulator. The documents listed are
              generated samples, not real DigiLocker records. Encryption, IPFS storage and ledger anchoring are real.
            </span>
          </div>
        )}
      </section>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Vault summary">
        <Metric icon={Link2} label="Locker" value={status.linked ? 'Linked' : 'Not linked'}
          hint={status.linked ? `Since ${formatDate(status.linkedAt)}` : 'Link to list your issued documents'} />
        <Metric icon={FileText} label="Available to pull" value={status.linked ? pending : '—'}
          hint="Issued documents not yet in your vault" />
        <Metric icon={Anchor} label="Anchored on ledger" value={anchoredCount}
          hint="Encrypted on IPFS with an on-chain fingerprint" />
        <Metric icon={BadgeCheck} label="Verified this session" value={`${verifiedCount}/${anchoredCount}`}
          hint="Re-checked against the ledger just now" />
      </section>

      <section aria-labelledby="issued-heading">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 mt-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-sky-500/15 dark:text-sky-300 mb-1">
              <FolderLock size={12} /> DigiLocker Repository
            </div>
            <h2 id="issued-heading" className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Issued Documents
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Verified clinical certificates and diagnostic reports available from your linked DigiLocker account
            </p>
          </div>
          {status.linked && (
            <button type="button" onClick={loadIssued} className="obs-btn-ghost text-xs"><RefreshCw size={13} /> Refresh</button>
          )}
        </div>

        {!status.linked ? (
          <div className="premium-card p-8 text-center">
            <FolderLock className="mx-auto text-slate-400" size={28} />
            <p className="mt-3 font-semibold text-slate-800 dark:text-slate-100">Link DigiLocker to see your documents</p>
            <p className="obs-muted mx-auto mt-1 max-w-md text-sm">
              You approve access on a consent screen. Only the documents you choose are copied into your vault.
            </p>
          </div>
        ) : issuedError ? (
          <div className="dashboard-message is-error flex items-center justify-between gap-3" role="alert">
            <span>{issuedError}</span>
            <button type="button" onClick={loadIssued} className="obs-btn-ghost shrink-0">Retry</button>
          </div>
        ) : issued.length === 0 ? (
          <div className="premium-card obs-muted p-8 text-center text-sm">No issued documents were found in this DigiLocker account.</div>
        ) : (
          <div className="premium-table-wrap overflow-x-auto">
            {!ledgerAvailable && (
              <p className="dashboard-message is-error m-3" role="status">
                The ledger is not reachable, so anchoring status may be out of date. Pulling a document will retry automatically.
              </p>
            )}
            <table className="premium-table">
              <thead>
                <tr><th>Document</th><th>Type</th><th>Issuer</th><th>Issued</th><th>Size</th><th className="!text-right">Action</th></tr>
              </thead>
              <tbody>
                {issued.map(doc => (
                  <tr key={doc.uri}>
                    <td className="font-semibold">{doc.name}</td>
                    <td><TypePill type={doc.docType} /></td>
                    <td>{doc.issuer}</td>
                    <td>{formatDate(doc.issuedAt)}</td>
                    <td>{formatSize(doc.size)}</td>
                    <td className="!text-right">
                      {doc.anchored ? (
                        <span className="status-pill is-ok"><span className="status-pill-dot" />Synced</span>
                      ) : (
                        <button type="button" onClick={() => pull(doc)} disabled={Boolean(busy[doc.uri])} className="obs-btn">
                          <Anchor size={14} /> {busy[doc.uri] ? 'Encrypting & anchoring…' : 'Pull & anchor'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="vault-heading">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 mt-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 mb-1">
              <ShieldCheck size={12} /> Hyperledger Fabric Public Vault
            </div>
            <h2 id="vault-heading" className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Anchored Personal Vault
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Encrypted IPFS-pinned health records permanently anchored on the blockchain ledger
            </p>
          </div>
          <button type="button" onClick={loadVault} className="obs-btn-ghost text-xs"><RefreshCw size={13} /> Refresh</button>
        </div>

        {vaultError ? (
          <div className="dashboard-message is-error flex items-center justify-between gap-3" role="alert">
            <span>{vaultError}</span>
            <button type="button" onClick={loadVault} className="obs-btn-ghost shrink-0">Retry</button>
          </div>
        ) : vault.length === 0 ? (
          <div className="premium-card obs-muted p-8 text-center text-sm">
            Nothing is anchored yet. Pull a document above to add it to your vault.
          </div>
        ) : (
          <div className="premium-table-wrap overflow-x-auto">
            <table className="premium-table">
              <thead>
                <tr><th>Document</th><th>Type</th><th>Anchored</th><th>Fingerprint (SHA-256)</th><th>IPFS CID</th><th>Status</th><th className="!text-right">Actions</th></tr>
              </thead>
              <tbody>
                {vault.map(doc => {
                  const check = verified[doc.docId]
                  const active = doc.status === 'ANCHORED'
                  return (
                    <tr key={doc.docId}>
                      <td>
                        <div className="font-semibold">{doc.name || doc.docId}</div>
                        <div className="obs-muted text-[11px]">{doc.issuer || doc.issuerId}</div>
                      </td>
                      <td><TypePill type={doc.docType} /></td>
                      <td>{formatDateTime(doc.anchoredAt)}</td>
                      <td><CopyChip value={doc.contentHash} label="Content hash" /></td>
                      <td><CopyChip value={doc.cid} label="IPFS CID" /></td>
                      <td>
                        {!active ? (
                          <span className="status-pill is-neutral">Withdrawn</span>
                        ) : check ? (
                          <span className={`status-pill ${check.verified ? 'is-ok' : 'is-danger'}`} title={check.detail || ''}>
                            <span className="status-pill-dot" />{check.verified ? 'Verified' : 'Mismatch'}
                          </span>
                        ) : (
                          <span className="status-pill is-info"><span className="status-pill-dot" />Anchored</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button type="button" onClick={() => verify(doc)} disabled={Boolean(busy[`verify:${doc.docId}`])} className="obs-btn-ghost">
                            <ShieldCheck size={13} /> {busy[`verify:${doc.docId}`] ? 'Checking…' : 'Verify'}
                          </button>
                          {active && (
                            <>
                              <button type="button" onClick={() => download(doc)} disabled={Boolean(busy[`download:${doc.docId}`])} className="obs-btn-ghost">
                                <Download size={13} /> {busy[`download:${doc.docId}`] ? 'Decrypting…' : 'Download'}
                              </button>
                              <button type="button" onClick={() => setWithdraw(doc)} className="obs-btn-ghost is-danger" aria-label={`Withdraw ${doc.name || doc.docId}`}>
                                <Trash2 size={13} /> Withdraw
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={Boolean(withdraw)} onClose={() => setWithdraw(null)} title="Withdraw this document?" size="sm">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          “{withdraw?.name || withdraw?.docId}” will be marked withdrawn on the ledger and its encrypted copy unpinned from
          IPFS. The ledger history of the anchor and the withdrawal stays permanently. You can pull the document again later.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setWithdraw(null)}>Keep document</Button>
          <Button variant="danger" size="sm" loading={Boolean(withdraw && busy[`withdraw:${withdraw.docId}`])} onClick={confirmWithdraw}>
            Withdraw document
          </Button>
        </div>
      </Modal>
    </div>
  )
}
