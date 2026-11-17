import { useEffect, useState, useCallback } from 'react'
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  FileHeart,
  ShieldCheck,
  Stethoscope,
  User,
  ExternalLink,
  Plus,
  Trash2,
  Receipt,
  CheckCircle2,
  Clock,
  Layers,
  Search
} from 'lucide-react'
import ThemeToggle from './ThemeToggle.jsx'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/pharmacy'
const IPFS_GATEWAY = import.meta.env.VITE_IPFS_GATEWAY_URL || 'http://localhost:8090/ipfs'

const PRESET_PATIENTS = [
  { id: 'PAT-001', label: 'Alice Smith (PAT-001)' },
  { id: 'PAT-014', label: 'Bob Jones (PAT-014)' },
  { id: 'PAT-021', label: 'Carol Davis (PAT-021)' },
  { id: 'testuser', label: 'John Doe (testuser)' }
]

export default function App() {
  const [service, setService] = useState('checking')
  const [patientId, setPatientId] = useState('PAT-001')
  const [customInput, setCustomInput] = useState('')
  const [profile, setProfile] = useState(null)
  const [bills, setBills] = useState([])
  const [accessList, setAccessList] = useState([])
  const [network, setNetwork] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [newRequester, setNewRequester] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const showToast = (msg, isErr = false) => {
    setFeedback({ msg, isErr })
    setTimeout(() => setFeedback(null), 4000)
  }

  // Load patient data
  const loadPatientData = useCallback(async (id) => {
    try {
      const [profRes, billsRes, accRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/patient/${id}`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE_URL}/api/bills/patient/${id}`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/api/patient/${id}/access-list`).then(r => r.ok ? r.json() : [])
      ])

      if (profRes) setProfile(profRes)
      setBills(Array.isArray(billsRes) ? billsRes : [])
      setAccessList(Array.isArray(accRes) ? accRes : [])
    } catch (err) {
      console.warn('[PatientPortal] Error fetching patient data:', err.message)
    }
  }, [])

  // Health and network status
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_BASE_URL}/health`, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error('Offline')
        return r.json()
      })
      .then(() => setService('available'))
      .catch(() => setService('unavailable'))

    fetch(`${API_BASE_URL}/api/network-status`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setNetwork(data) })
      .catch(() => {})

    return () => controller.abort()
  }, [])

  useEffect(() => {
    loadPatientData(patientId)
  }, [patientId, loadPatientData])

  // Access Control Handlers
  const handleGrantAccess = async (e) => {
    e.preventDefault()
    if (!newRequester.trim()) return
    setActionLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/grant-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: patientId, patientId, requesterId: newRequester.trim() })
      })
      if (!res.ok) throw new Error('Failed to grant access')
      showToast(`Access granted to ${newRequester.trim()}`)
      setNewRequester('')
      loadPatientData(patientId)
    } catch (err) {
      showToast(err.message, true)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRevokeAccess = async (requesterId) => {
    setActionLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/revoke-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: patientId, patientId, requesterId })
      })
      if (!res.ok) throw new Error('Failed to revoke access')
      showToast(`Revoked access for ${requesterId}`)
      loadPatientData(patientId)
    } catch (err) {
      showToast(err.message, true)
    } finally {
      setActionLoading(false)
    }
  }

  // Derive unique prescribed medicines from bills
  const uniqueMedicines = []
  bills.forEach(bill => {
    const meds = Array.isArray(bill.medicineList) ? bill.medicineList : []
    meds.forEach(m => {
      uniqueMedicines.push({
        name: m.name,
        quantity: m.quantity,
        billId: bill.billId,
        issuedBy: bill.issuedBy || 'Pharmacy Staff',
        issuedAt: bill.issuedAt || bill.timestamp || new Date().toISOString(),
        status: bill.status || 'ACTIVE',
        ipfsHash: bill.ipfsHash
      })
    })
  })

  const reachable = service === 'available'

  return (
    <div className="patient-app">
      {/* Toast Notification */}
      {feedback && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 9999,
          padding: '12px 20px',
          borderRadius: 12,
          background: feedback.isErr ? '#ef4444' : '#10b981',
          color: '#fff',
          fontWeight: 700,
          fontSize: 13,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)'
        }}>
          {feedback.msg}
        </div>
      )}

      {/* Header */}
      <header className="patient-header">
        <a className="brand" href="#home" aria-label="Vitalis Pharmacy patient home" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.svg" alt="Vitalis" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <span>Vitalis<small>PHARMACY PATIENT PORTAL</small></span>
        </a>

        <div className="header-actions">
          {/* Patient Switcher */}
          <div className="patient-select-wrapper">
            <User size={15} />
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              aria-label="Switch Active Patient"
            >
              {PRESET_PATIENTS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <span className={`service-pill ${reachable ? 'is-up' : ''}`}>
            <i />
            {service === 'checking' ? 'Checking network' : reachable ? 'Service reachable' : 'Service offline'}
          </span>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <main id="home" className="patient-main">
        {/* Welcome Card */}
        <section className="welcome-card">
          <div className="welcome-copy">
            <p className="eyebrow">YOUR CARE, WITH CLARITY</p>
            <h1>Your pharmacy care,<br /><span>all in one place.</span></h1>
            <p>
              Review verified pharmacy records, track live medication dispensing activity,
              and manage data consent directly on the Hyperledger Fabric blockchain.
            </p>

            {/* Active Patient Bar */}
            <div className="patient-info-bar">
              <span>Patient: <strong>{profile ? profile.name : `Patient ${patientId}`}</strong></span>
              <span>ID: <strong>{patientId}</strong></span>
              <span>Age: <strong>{profile ? profile.age : 32}</strong></span>
              <span>Cert Alias: <strong>{profile ? profile.certAlias : 'user1'}</strong></span>
              <span className="badge-tag mint"><CheckCircle2 size={12} /> Connected</span>
            </div>
          </div>

          <div className="welcome-art" aria-hidden="true">
            <div className="art-orbit orbit-a" />
            <div className="art-orbit orbit-b" />
            <div className="art-center"><FileHeart size={44} /></div>
            <span className="art-dot dot-a" />
            <span className="art-dot dot-b" />
          </div>
        </section>

        {/* Custom Patient Search Bar */}
        <div style={{ display: 'flex', gap: 10, marginTop: 18, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Lookup another Patient ID (e.g. PAT-001)..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 12,
                outline: 'none'
              }}
            />
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (customInput.trim()) {
                setPatientId(customInput.trim())
                setCustomInput('')
              }
            }}
          >
            Switch Patient
          </button>
        </div>

        {/* Section Heading */}
        <section className="content-heading">
          <div>
            <p className="eyebrow">PATIENT SERVICES</p>
            <h2>What you’ll find here</h2>
          </div>
          <span className="badge-tag mint" style={{ padding: '6px 12px', fontSize: 11 }}>
            <CheckCircle2 size={13} /> Connected & Synced
          </span>
        </section>

        {/* Service Cards Grid */}
        <div className="service-grid">
          {/* Card 1: My pharmacy records */}
          <article
            className={`service-card ${activeTab === 'records' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('records')}
          >
            <span className="service-icon blue"><FileHeart size={20} /></span>
            <h3>My pharmacy records</h3>
            <p>
              {uniqueMedicines.length > 0
                ? `${uniqueMedicines.length} prescription medications on file with decentralized verification.`
                : 'Review active and past prescriptions issued by hospital doctors and clinics.'}
            </p>
            <span className="card-status is-connected">
              {uniqueMedicines.length > 0 ? `${uniqueMedicines.length} ACTIVE RECORDS` : 'VERIFIED ON-CHAIN'}
            </span>
          </article>

          {/* Card 2: Medication activity */}
          <article
            className={`service-card ${activeTab === 'activity' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            <span className="service-icon mint"><CalendarDays size={20} /></span>
            <h3>Medication activity</h3>
            <p>
              {bills.length > 0
                ? `${bills.length} verified dispensing events recorded on Hyperledger Fabric ledger.`
                : 'View verified dispensing activity and dosage instructions from connected pharmacy services.'}
            </p>
            <span className="card-status is-connected">
              {bills.length > 0 ? `${bills.length} DISPENSING LOGS` : 'LIVE ON-CHAIN'}
            </span>
          </article>

          {/* Card 3: Access and privacy */}
          <article
            className={`service-card ${activeTab === 'privacy' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            <span className="service-icon violet"><ShieldCheck size={20} /></span>
            <h3>Access and privacy</h3>
            <p>
              {accessList.length > 0
                ? `${accessList.length} pharmacy providers authorized. Self-govern your consent.`
                : 'Manage permissions and grant or revoke access for pharmacists and doctors.'}
            </p>
            <span className="card-status is-connected">
              {accessList.length > 0 ? `${accessList.length} AUTHORIZED PROVIDERS` : 'ACCESS CONTROLLED'}
            </span>
          </article>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="tabs-bar">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Layers size={15} /> Overview
          </button>
          <button
            className={`tab-btn ${activeTab === 'records' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('records')}
          >
            <FileHeart size={15} /> Prescriptions ({uniqueMedicines.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'activity' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            <CalendarDays size={15} /> Dispensing Activity ({bills.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'privacy' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            <ShieldCheck size={15} /> Consent & Privacy ({accessList.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'billing' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('billing')}
          >
            <Receipt size={15} /> Invoices & IPFS ({bills.length})
          </button>
        </div>

        {/* Tab View 1: Prescriptions Panel */}
        {activeTab === 'records' && (
          <section className="panel-card">
            <div className="panel-header">
              <div>
                <h3><FileHeart size={20} color="#2563eb" /> Active Prescriptions & Medications</h3>
                <p>Decentralized pharmacy records linked to patient identity on Hyperledger Fabric.</p>
              </div>
              <span className="badge-tag mint">{uniqueMedicines.length} Prescriptions Available</span>
            </div>

            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medication Name</th>
                    <th>Prescribed Qty</th>
                    <th>Issued By</th>
                    <th>Date Prescribed</th>
                    <th>Status</th>
                    <th>IPFS Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {uniqueMedicines.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
                        No medication records found for patient {patientId}.
                      </td>
                    </tr>
                  ) : (
                    uniqueMedicines.map((m, idx) => (
                      <tr key={m.billId + idx}>
                        <td style={{ fontWeight: 700 }}>{m.name}</td>
                        <td>{m.quantity}</td>
                        <td>{m.issuedBy}</td>
                        <td>{new Date(m.issuedAt).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge-tag ${m.status === 'DISPENSED' ? 'mint' : 'amber'}`}>
                            {m.status}
                          </span>
                        </td>
                        <td>
                          {m.ipfsHash ? (
                            <a
                              href={`${IPFS_GATEWAY}/${m.ipfsHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="ipfs-chip"
                            >
                              {m.ipfsHash.substring(0, 14)}... <ExternalLink size={11} />
                            </a>
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: 11 }}>N/A</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab View 2: Medication Activity Panel */}
        {activeTab === 'activity' && (
          <section className="panel-card">
            <div className="panel-header">
              <div>
                <h3><CalendarDays size={20} color="#10b981" /> Dispensing & Fulfillment Activity</h3>
                <p>Immutable audit trail of medication dispensing events fulfilled by pharmacy staff.</p>
              </div>
              <span className="badge-tag mint">{bills.length} Verified Events</span>
            </div>

            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bill / Event ID</th>
                    <th>Prescription Package</th>
                    <th>Medicines Dispensed</th>
                    <th>Fulfilled By</th>
                    <th>Timestamp</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
                        No dispensing activity recorded yet for {patientId}.
                      </td>
                    </tr>
                  ) : (
                    bills.map((b) => (
                      <tr key={b.billId}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{b.billId}</td>
                        <td style={{ fontWeight: 600 }}>{b.templateName || 'Prescription Order'}</td>
                        <td>
                          {Array.isArray(b.medicineList)
                            ? b.medicineList.map(m => `${m.name} (×${m.quantity})`).join(', ')
                            : 'N/A'}
                        </td>
                        <td>{b.issuedBy || 'Pharmacist'}</td>
                        <td>{new Date(b.issuedAt || b.timestamp || Date.now()).toLocaleString()}</td>
                        <td>
                          <span className="badge-tag mint"><CheckCircle2 size={11} /> Dispensed</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab View 3: Consent & Privacy Panel */}
        {activeTab === 'privacy' && (
          <section className="panel-card">
            <div className="panel-header">
              <div>
                <h3><ShieldCheck size={20} color="#8b5cf6" /> Access Control & Consent Self-Governance</h3>
                <p>Control which pharmacy staff, nurses, and external clinics can access your pharmacy records.</p>
              </div>
              <span className="badge-tag violet">{accessList.length} Active Grants</span>
            </div>

            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Identity / Role</th>
                    <th>Permission Level</th>
                    <th>Grant Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accessList.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
                        No external identities currently have access to your pharmacy data.
                      </td>
                    </tr>
                  ) : (
                    accessList.map((id) => (
                      <tr key={id}>
                        <td style={{ fontWeight: 700 }}>{id}</td>
                        <td>Read & Verify Prescriptions</td>
                        <td>
                          <span className="badge-tag mint"><CheckCircle2 size={11} /> Granted</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={actionLoading}
                            onClick={() => handleRevokeAccess(id)}
                          >
                            <Trash2 size={12} /> Revoke Access
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Grant Access Box */}
            <form className="grant-box" onSubmit={handleGrantAccess}>
              <Plus size={16} color="#2563eb" />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Grant Access to New Identity:</span>
              <input
                type="text"
                placeholder="Identity ID (e.g. ph_alice, doc_smith)..."
                value={newRequester}
                onChange={(e) => setNewRequester(e.target.value)}
                disabled={actionLoading}
              />
              <button className="btn btn-primary btn-sm" type="submit" disabled={actionLoading || !newRequester.trim()}>
                Authorize Identity
              </button>
            </form>
          </section>
        )}

        {/* Tab View 4: Invoices & Receipts Panel */}
        {activeTab === 'billing' && (
          <section className="panel-card">
            <div className="panel-header">
              <div>
                <h3><Receipt size={20} color="#f59e0b" /> Prescription Billing & IPFS Receipts</h3>
                <p>Verifiable receipts and billing records pinned to decentralized IPFS storage.</p>
              </div>
              <span className="badge-tag amber">
                Total: ${bills.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0).toFixed(2)}
              </span>
            </div>

            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Prescription Type</th>
                    <th>Amount ($)</th>
                    <th>Issued By</th>
                    <th>Issued Date</th>
                    <th>IPFS Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
                        No billing receipts found for {patientId}.
                      </td>
                    </tr>
                  ) : (
                    bills.map((b) => (
                      <tr key={b.billId}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{b.billId}</td>
                        <td>{b.templateName || 'Prescription Order'}</td>
                        <td style={{ fontWeight: 700, color: '#16a34a' }}>${parseFloat(b.amount || 0).toFixed(2)}</td>
                        <td>{b.issuedBy || 'Central Billing'}</td>
                        <td>{new Date(b.issuedAt || b.timestamp || Date.now()).toLocaleDateString()}</td>
                        <td>
                          {b.ipfsHash ? (
                            <a
                              href={`${IPFS_GATEWAY}/${b.ipfsHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="ipfs-chip"
                            >
                              {b.ipfsHash.substring(0, 16)}... <ExternalLink size={11} />
                            </a>
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: 11 }}>N/A</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Overview Tab Default Summary */}
        {activeTab === 'overview' && (
          <section className="panel-card">
            <div className="panel-header">
              <div>
                <h3><Activity size={20} color="#2563eb" /> Patient Care Summary</h3>
                <p>Summary of on-chain healthcare credentials, active orders, and data permissions.</p>
              </div>
              <span className="badge-tag mint">Live Hyperledger Fabric State</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 16, background: 'rgba(37,99,235,0.03)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Active Prescriptions</span>
                <h4 style={{ margin: '8px 0', fontSize: 24, fontFamily: 'Manrope, sans-serif' }}>{uniqueMedicines.length}</h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Fulfilled and active medications on file</p>
              </div>

              <div style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 16, background: 'rgba(16,185,129,0.03)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Dispensing Orders</span>
                <h4 style={{ margin: '8px 0', fontSize: 24, fontFamily: 'Manrope, sans-serif' }}>{bills.length}</h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Verified dispensing transactions committed</p>
              </div>

              <div style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 16, background: 'rgba(139,92,246,0.03)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Authorized Providers</span>
                <h4 style={{ margin: '8px 0', fontSize: 24, fontFamily: 'Manrope, sans-serif' }}>{accessList.length}</h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Staff identities with consent permissions</p>
              </div>

              <div style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 16, background: 'rgba(245,158,11,0.03)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Pharmacy Spend</span>
                <h4 style={{ margin: '8px 0', fontSize: 24, fontFamily: 'Manrope, sans-serif' }}>
                  ${bills.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0).toFixed(2)}
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Receipts backed by IPFS hash validation</p>
              </div>
            </div>
          </section>
        )}

        {/* Network & Infrastructure Status */}
        <section className="connection-card">
          <div className="connection-icon"><Stethoscope size={20} /></div>
          <div style={{ flex: 1 }}>
            <h2>{reachable ? 'Pharmacy Network Connected' : 'Checking Pharmacy Service'}</h2>
            <p>
              {reachable
                ? 'Hyperledger Fabric channel ehrchannel is active. IPFS decentralized storage node is reachable.'
                : 'Connecting to local pharmacy nodes...'}
            </p>

            <div className="nodes-grid">
              <div className="node-card">
                <small>Peer0 (Manager / Outpatient)</small>
                <span>Height #{network?.nodes?.peer0 ?? 18}</span>
              </div>
              <div className="node-card">
                <small>Peer1 (Dispensing & Billing)</small>
                <span>Height #{network?.nodes?.peer1 ?? 18}</span>
              </div>
              <div className="node-card">
                <small>Peer2 (Inventory Stock)</small>
                <span>Height #{network?.nodes?.peer2 ?? 18}</span>
              </div>
              <div className="node-card">
                <small>IPFS Cluster</small>
                <span style={{ color: '#16a34a' }}>{network?.ipfs || 'UP'} (Kubo 0.28)</span>
              </div>
            </div>
          </div>
          <ArrowUpRight size={18} className="connection-arrow" />
        </section>

        <footer>
          Vitalis Pharmacy Suite · Backed by Hyperledger Fabric &amp; IPFS · Verifiable Dispensing &amp; Inventory Ledger
        </footer>
      </main>
    </div>
  )
}
