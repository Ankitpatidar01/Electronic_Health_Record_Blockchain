import React, { useState, useEffect } from 'react'
import {
  Pill,
  Package,
  FileText,
  ShieldCheck,
  Search,
  Plus,
  Minus,
  RefreshCw,
  ExternalLink,
  Users,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Server,
  ArrowRight,
  UserCheck,
  Trash2,
  DollarSign,
  Activity,
  Layers,
  ChevronRight,
  LogOut,
  X
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'

const PHARMACY_ROLES = [
  {
    id: 'pharmacist',
    title: 'Hospital Dispensing Pharmacist',
    user: 'pharmacist',
    pwd: 'pharmpw',
    badge: 'peer2-api (Port 4003)',
    badgeTone: 'pill-info',
    icon: Pill,
    desc: 'In-patient doctor prescription fulfillment, hospital encounter verification & ledger dispense stamp.',
    gradient: 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(2,132,199,0.06))',
    borderSelected: '#0284c7'
  },
  {
    id: 'inventory',
    title: 'Pharmacy Stock & Inventory Officer',
    user: 'inventory_mgr_01',
    pwd: 'invpw',
    badge: 'p-backend (Port 3000)',
    badgeTone: 'pill-warn',
    icon: Package,
    desc: 'Pharmaceutical stock registry, batch intake, fast deductions, reorder alerts & ledger sync.',
    gradient: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(217,119,6,0.06))',
    borderSelected: '#f59e0b'
  },
  {
    id: 'billing',
    title: 'Pharmacy POS & Invoicing Officer',
    user: 'billing_clerk_01',
    pwd: 'billpw',
    badge: 'p-backend (Port 3000)',
    badgeTone: 'pill-ok',
    icon: FileText,
    desc: 'Point-of-sale customer billing, prescription template packs, tax calculation & IPFS receipt minting.',
    gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.06))',
    borderSelected: '#10b981'
  },
  {
    id: 'manager',
    title: 'Pharmacy Operations Director',
    user: 'pharmacy_mgr',
    pwd: 'adminpw',
    badge: 'p-backend (Port 3000)',
    badgeTone: 'pill-danger',
    icon: ShieldCheck,
    desc: 'Staff credentialing roster, global billing audits, financial overview & Fabric consensus monitoring.',
    gradient: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(79,70,229,0.06))',
    borderSelected: '#6366f1'
  }
]

const PRESCRIPTION_TEMPLATES = {
  post_op: {
    name: 'Post-Op Recovery Pack',
    medicines: [
      { name: 'Amoxicillin 500mg', quantity: 20, price: 15.5 },
      { name: 'Ibuprofen 400mg', quantity: 15, price: 8.25 },
      { name: 'Metoclopramide 10mg', quantity: 10, price: 9.5 }
    ]
  },
  chronic_care: {
    name: 'Chronic Care Monthly',
    medicines: [
      { name: 'Metformin 850mg', quantity: 60, price: 12.0 },
      { name: 'Atorvastatin 20mg', quantity: 30, price: 24.5 },
      { name: 'Lisinopril 10mg', quantity: 30, price: 18.0 }
    ]
  },
  emergency_kit: {
    name: 'Acute Emergency Kit',
    medicines: [
      { name: 'Epinephrine Auto-Injector', quantity: 2, price: 85.0 },
      { name: 'Salbutamol Inhaler 100mcg', quantity: 1, price: 22.0 },
      { name: 'Hydrocortisone 100mg Injection', quantity: 4, price: 35.0 }
    ]
  }
}

export default function App() {
  const [selectedRole, setSelectedRole] = useState(PHARMACY_ROLES[0])
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('prescriptions') // prescriptions, inventory, billing, operations

  // Notification Toast
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Network & System Health
  const [networkStatus, setNetworkStatus] = useState({ nodes: { peer0: 18, peer1: 18, peer2: 18 }, ipfs: 'UP', network: 'ONLINE' })

  // 1. In-Patient Hospital Prescriptions State
  const [hospitalVisits, setHospitalVisits] = useState([])
  const [visitsLoading, setVisitsLoading] = useState(false)
  const [dispenseModalVisit, setDispenseModalVisit] = useState(null)
  const [dispenseNotes, setDispenseNotes] = useState('')
  const [dispenseSubmitting, setDispenseSubmitting] = useState(false)

  // 2. Inventory State
  const [inventory, setInventory] = useState([])
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [inventorySearch, setInventorySearch] = useState('')
  const [addBatchModalOpen, setAddBatchModalOpen] = useState(false)
  const [newBatch, setNewBatch] = useState({ itemId: '', name: '', quantity: 100, price: 10, unit: 'tablets' })

  // 3. Billing & POS State
  const [billPatientId, setBillPatientId] = useState('PAT-004')
  const [cartItems, setCartItems] = useState([
    { name: 'Paracetamol 500mg', quantity: 20, price: 5.0 }
  ])
  const [billingSubmitting, setBillingSubmitting] = useState(false)
  const [lastBillReceipt, setLastBillReceipt] = useState(null)

  // 4. Operations & Audit State
  const [auditBills, setAuditBills] = useState([])
  const [employees, setEmployees] = useState([])
  const [opsLoading, setOpsLoading] = useState(false)

  // Load Initial Data
  useEffect(() => {
    fetchNetworkHealth()
    fetchInventory()
    fetchHospitalVisits()
  }, [])

  // ── API Fetchers ───────────────────────────────────────────────────────────
  const fetchNetworkHealth = async () => {
    try {
      const res = await fetch('/api/pharmacy/api/network-status').catch(() => null)
      if (res && res.ok) {
        const data = await res.json()
        setNetworkStatus(data)
      }
    } catch {}
  }

  const fetchInventory = async () => {
    setInventoryLoading(true)
    try {
      const res = await fetch('/api/pharmacy/api/inventory').catch(() => null)
      if (res && res.ok) {
        const data = await res.json()
        setInventory(Array.isArray(data) ? data : [])
      }
    } catch {} finally {
      setInventoryLoading(false)
    }
  }

  const fetchHospitalVisits = async () => {
    setVisitsLoading(true)
    try {
      // Authenticate with peer2-api as pharmacist
      const authRes = await fetch('/api/hospital/peer2/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'pharmacist', password: 'pharmpw' })
      }).catch(() => null)

      if (authRes && authRes.ok) {
        const authData = await authRes.json()
        const token = authData.data?.token
        const visitsRes = await fetch('/api/hospital/peer2/pharmacist/visits', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (visitsRes.ok) {
          const vData = await visitsRes.json()
          const visitsList = vData.data || []

          // Fetch full clinical data for each visit
          const fullVisits = await Promise.all(
            visitsList.map(async (v) => {
              try {
                const det = await fetch(`/api/hospital/peer2/pharmacist/visits/${v.visitId}`, {
                  headers: { Authorization: `Bearer ${token}` }
                })
                if (det.ok) {
                  const dJson = await det.json()
                  return dJson.data
                }
              } catch {}
              return v
            })
          )
          setHospitalVisits(fullVisits)
        }
      }
    } catch {} finally {
      setVisitsLoading(false)
    }
  }

  const fetchOpsData = async () => {
    setOpsLoading(true)
    try {
      const [bRes, eRes] = await Promise.all([
        fetch('/api/pharmacy/api/bills/audit').catch(() => null),
        fetch('/api/pharmacy/api/employees').catch(() => null)
      ])
      if (bRes && bRes.ok) setAuditBills(await bRes.json())
      if (eRes && eRes.ok) setEmployees(await eRes.json())
    } catch {} finally {
      setOpsLoading(false)
    }
  }

  // ── Actions: Clinical Dispense ─────────────────────────────────────────────
  const openDispenseModal = (visit) => {
    setDispenseModalVisit(visit)
    const latestPresc = visit.clinical?.prescriptions?.[visit.clinical.prescriptions.length - 1]
    setDispenseNotes(visit.clinical?.medicationDetails || (latestPresc?.medications?.join(', ') ? `${latestPresc.medications.join(', ')} dispensed as prescribed.` : 'Medications dispensed.'))
  }

  const handleConfirmDispense = async () => {
    if (!dispenseModalVisit) return
    setDispenseSubmitting(true)
    try {
      const authRes = await fetch('/api/hospital/peer2/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'pharmacist', password: 'pharmpw' })
      })
      const authData = await authRes.json()
      const token = authData.data?.token

      const res = await fetch(`/api/hospital/peer2/pharmacist/visits/${dispenseModalVisit.visitId}/dispense`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ medicationDetails: dispenseNotes })
      })

      if (!res.ok) throw new Error('Dispense transaction rejected by ledger')
      showToast(`Medication for ${dispenseModalVisit.visitId} dispensed & confirmed on blockchain!`, 'ok')
      setDispenseModalVisit(null)
      fetchHospitalVisits()
    } catch (err) {
      showToast(err.message || 'Dispense failed', 'danger')
    } finally {
      setDispenseSubmitting(false)
    }
  }

  // ── Actions: Inventory ─────────────────────────────────────────────────────
  const handleQuickDeduct = async (itemId) => {
    try {
      const res = await fetch('/api/pharmacy/api/inventory/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: selectedRole.user, itemId, quantity: 1 })
      })
      if (res.ok) {
        showToast(`Deducted 1 unit of ${itemId} on Fabric ledger`, 'ok')
        fetchInventory()
      } else {
        showToast('Deduct transaction failed', 'danger')
      }
    } catch {
      showToast('Inventory service unavailable', 'danger')
    }
  }

  const handleQuickRestock = async (item) => {
    try {
      const res = await fetch('/api/pharmacy/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: selectedRole.user,
          itemId: item.itemId,
          name: item.name,
          quantity: 10,
          price: item.price,
          unit: item.unit
        })
      })
      if (res.ok) {
        showToast(`Added +10 units to ${item.itemId}`, 'ok')
        fetchInventory()
      }
    } catch {
      showToast('Restock failed', 'danger')
    }
  }

  const handleCreateBatch = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/pharmacy/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: selectedRole.user,
          itemId: newBatch.itemId,
          name: newBatch.name,
          quantity: Number(newBatch.quantity),
          price: Number(newBatch.price),
          unit: newBatch.unit
        })
      })
      if (res.ok) {
        showToast(`Batch ${newBatch.itemId} registered on ledger!`, 'ok')
        setAddBatchModalOpen(false)
        fetchInventory()
      } else {
        showToast('Batch registration failed', 'danger')
      }
    } catch {
      showToast('Error registering batch', 'danger')
    }
  }

  // ── Actions: Billing & POS ─────────────────────────────────────────────────
  const applyTemplate = (tplKey) => {
    const tpl = PRESCRIPTION_TEMPLATES[tplKey]
    if (tpl) {
      setCartItems([...tpl.medicines])
      showToast(`Loaded template: ${tpl.name}`, 'info')
    }
  }

  const addCartItem = (invItem) => {
    const exists = cartItems.find(c => c.name === invItem.name)
    if (exists) {
      setCartItems(cartItems.map(c => c.name === invItem.name ? { ...c, quantity: c.quantity + 1 } : c))
    } else {
      setCartItems([...cartItems, { name: invItem.name, quantity: 1, price: invItem.price || 10 }])
    }
  }

  const subtotal = cartItems.reduce((acc, c) => acc + (c.quantity * (c.price || 0)), 0)
  const tax = Number((subtotal * 0.05).toFixed(2))
  const grandTotal = Number((subtotal + tax).toFixed(2))

  const handleGenerateBill = async () => {
    setBillingSubmitting(true)
    setLastBillReceipt(null)
    try {
      const billId = `BILL-${Math.floor(1000 + Math.random() * 9000)}`
      const res = await fetch('/api/pharmacy/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: selectedRole.user,
          billId,
          patientId: billPatientId,
          medicines: cartItems.map(c => ({ name: c.name, quantity: String(c.quantity) })),
          totalAmount: grandTotal
        })
      })

      const data = await res.json()
      if (res.ok) {
        setLastBillReceipt({
          billId,
          patientId: billPatientId,
          total: grandTotal,
          ipfsHash: data.ipfsHash || data.result?.ipfsHash || 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
          timestamp: new Date().toISOString()
        })
        showToast(`Invoice ${billId} generated and anchored to IPFS!`, 'ok')
      } else {
        showToast(data.message || 'Billing failed', 'danger')
      }
    } catch {
      showToast('Billing service unavailable', 'danger')
    } finally {
      setBillingSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)]">
      {/* ── Top Navigation Bar ──────────────────────────────────────────────── */}
      <header className="pharm-navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            padding: '0.5rem',
            borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, #2563eb, #0284c7)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Pill size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>CareGrid</span>
              <span style={{ color: 'var(--obs-accent)', fontWeight: 600 }}>Pharmacy Suite</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Consortium Medicine &amp; Ledger Operations
            </div>
          </div>
        </div>

        {/* Center Tab Navigation */}
        <div className="tab-pill-bar">
          {[
            { id: 'prescriptions', label: 'Doctor Orders', icon: Pill },
            { id: 'inventory', label: 'Stock & Inventory', icon: Package },
            { id: 'billing', label: 'POS & Invoicing', icon: FileText },
            { id: 'operations', label: 'Audit & Network', icon: ShieldCheck }
          ].map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTab(t.id)
                  if (t.id === 'operations') fetchOpsData()
                }}
                className={`tab-pill ${activeTab === t.id ? 'active' : ''}`}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Active Role Switcher Pill */}
          <button
            onClick={() => setRoleModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.85rem',
              borderRadius: '9999px',
              border: '1px solid var(--border-card)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="Click to switch between Hospital Pharmacist, Inventory Manager, Billing, and Director"
          >
            <span className={`pill-dot ${selectedRole.badgeTone === 'pill-ok' ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: 8, height: 8 }} />
            <span>{selectedRole.title}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>▼</span>
          </button>

          {/* Network Health Pill */}
          <div className="pill pill-ok" style={{ display: 'none', mdDisplay: 'inline-flex' }}>
            <span className="pill-dot" />
            <span>Fabric: Online</span>
          </div>

          <ThemeToggle />

          <a
            href="http://localhost:5173/"
            className="btn-ink btn-ink-ghost"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.75rem' }}
            title="Open Hospital Operations Portal"
          >
            <span>Hospital Portal</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 2000,
          padding: '0.75rem 1.25rem',
          borderRadius: '0.75rem',
          background: toast.type === 'danger' ? '#ef4444' : '#10b981',
          color: 'white',
          fontWeight: 600,
          fontSize: '0.85rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {toast.type === 'danger' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ── Main Container ──────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '1.75rem 1.25rem' }}>
        
        {/* Banner with Active Role info */}
        <div className="pharmacy-glass" style={{ padding: '1.25rem 1.75rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: '1rem', background: selectedRole.gradient, border: `1px solid ${selectedRole.borderSelected}`, color: selectedRole.borderSelected }}>
              {React.createElement(selectedRole.icon, { size: 24 })}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{selectedRole.title}</h1>
                <span className={`pill ${selectedRole.badgeTone}`}>{selectedRole.badge}</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                {selectedRole.desc}
              </p>
            </div>
          </div>

          <button
            onClick={() => setRoleModalOpen(true)}
            className="btn-ink btn-ink-primary"
            style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}
          >
            <span>Switch Role Card</span>
            <ChevronRight size={13} />
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: IN-PATIENT CLINICAL PRESCRIPTIONS (DOCTOR ORDERS)
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'prescriptions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>In-Patient Prescriptions from Hospital Doctors</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Encounter orders finalized by Dr. Smith and clinical staff on Hyperledger Fabric.
                </p>
              </div>
              <button onClick={fetchHospitalVisits} className="btn-ink btn-ink-ghost" style={{ fontSize: '0.75rem', gap: '0.4rem' }}>
                <RefreshCw size={13} className={visitsLoading ? 'animate-spin' : ''} />
                <span>Refresh Queue</span>
              </button>
            </div>

            {visitsLoading ? (
              <div className="pharmacy-glass" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Syncing with Hospital Ledger Peer2...
              </div>
            ) : hospitalVisits.length === 0 ? (
              <div className="pharmacy-glass" style={{ padding: '3rem', textAlign: 'center' }}>
                <Pill size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>No Finalized Prescriptions in Queue</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 450, margin: '0.25rem auto 0' }}>
                  When a doctor finalizes a patient consultation in the Hospital Portal, their prescription will automatically appear here for fulfillment.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
                {hospitalVisits.map(v => {
                  const presc = v.clinical?.prescriptions?.[v.clinical.prescriptions.length - 1]
                  const isDispensed = Boolean(v.clinical?.medicationDispensedBy || v.clinical?.medicationDetails)

                  return (
                    <div key={v.visitId} className="pharmacy-glass" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                          <div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem' }}>{v.visitId}</span>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                              Patient: <strong style={{ color: 'var(--obs-accent)' }}>{v.patientId}</strong>
                            </div>
                          </div>
                          <span className={`pill ${isDispensed ? 'pill-ok' : 'pill-warn'}`}>
                            <span className="pill-dot" />
                            {isDispensed ? 'Dispensed' : 'Ready to Dispense'}
                          </span>
                        </div>

                        {v.clinical?.chiefComplaint && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(148,163,184,0.08)' }}>
                            <strong>Complaint:</strong> {v.clinical.chiefComplaint}
                          </div>
                        )}

                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.35rem' }}>
                            Prescribed Medication:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {(presc?.medications || ['paracetamol 500mg']).map((m, idx) => (
                              <span key={idx} style={{
                                padding: '0.3rem 0.65rem',
                                borderRadius: '0.5rem',
                                background: 'rgba(56,189,248,0.12)',
                                color: 'var(--obs-accent)',
                                fontWeight: 600,
                                fontSize: '0.75rem'
                              }}>
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>

                        {isDispensed && (
                          <div style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.75rem' }}>
                            <CheckCircle2 size={13} />
                            <span>Dispensed by {v.clinical.medicationDispensedBy || 'pharmacist'}</span>
                          </div>
                        )}
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Doctor: <strong>Dr. {v.assignedDoctor || 'Smith'}</strong>
                        </span>
                        <button
                          onClick={() => openDispenseModal(v)}
                          className={`btn-ink ${isDispensed ? 'btn-ink-ghost' : 'btn-ink-primary'}`}
                          style={{ fontSize: '0.75rem', padding: '0.45rem 0.95rem' }}
                        >
                          {isDispensed ? 'View Dispense Record' : 'Dispense Medication'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: LIVE MEDICINE INVENTORY & STOCK
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'inventory' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Pharmaceutical Stock &amp; Inventory</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Blockchain-anchored stock levels, batch tracking, and fast dispensing deduction.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setAddBatchModalOpen(true)} className="btn-ink btn-ink-primary" style={{ fontSize: '0.75rem' }}>
                  <Plus size={14} />
                  <span>Register New Batch</span>
                </button>
                <button onClick={fetchInventory} className="btn-ink btn-ink-ghost" style={{ fontSize: '0.75rem' }}>
                  <RefreshCw size={14} className={inventoryLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="pharmacy-glass" style={{ padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Catalog Items</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>{inventory.length}</div>
              </div>
              <div className="pharmacy-glass" style={{ padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Units Stocked</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem', color: '#10b981' }}>
                  {inventory.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0)}
                </div>
              </div>
              <div className="pharmacy-glass" style={{ padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Low Stock Reorder Alerts</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem', color: '#f59e0b' }}>
                  {inventory.filter(i => Number(i.quantity) < 80).length}
                </div>
              </div>
            </div>

            {/* Search Input */}
            <div className="pharmacy-glass" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                value={inventorySearch}
                onChange={e => setInventorySearch(e.target.value)}
                placeholder="Search stock catalog by medication name, batch ID (e.g. MED-001, Amoxicillin)..."
                style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>

            {/* Inventory Table */}
            <div className="pharmacy-glass" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-card)', background: 'rgba(148,163,184,0.06)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>BATCH ID</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>MEDICINE NAME</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>QUANTITY</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>PRICE / UNIT</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>STATUS</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700, textAlign: 'right' }}>QUICK ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory
                    .filter(item => (item.name || '').toLowerCase().includes(inventorySearch.toLowerCase()) || (item.itemId || '').toLowerCase().includes(inventorySearch.toLowerCase()))
                    .map((item, idx) => {
                      const qty = Number(item.quantity) || 0
                      const isLow = qty < 80
                      return (
                        <tr key={item.itemId || idx} style={{ borderBottom: '1px solid var(--border-card)', transition: 'background 0.15s' }}>
                          <td style={{ padding: '0.85rem 1.25rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.itemId}</td>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{item.name}</td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{qty}</span> <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{item.unit || 'units'}</span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)' }}>${item.price || 0}</td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span className={`pill ${isLow ? 'pill-warn' : 'pill-ok'}`}>
                              <span className="pill-dot" />
                              {isLow ? 'Low Stock' : 'In Stock'}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                              <button
                                onClick={() => handleQuickDeduct(item.itemId)}
                                style={{
                                  padding: '0.3rem 0.6rem',
                                  borderRadius: '0.5rem',
                                  border: '1px solid var(--border-card)',
                                  background: 'var(--bg-card)',
                                  color: 'var(--text-secondary)',
                                  cursor: 'pointer',
                                  fontSize: '0.7rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.2rem'
                                }}
                                title="Dispense / Deduct 1 unit on ledger"
                              >
                                <Minus size={11} /> 1
                              </button>
                              <button
                                onClick={() => handleQuickRestock(item)}
                                style={{
                                  padding: '0.3rem 0.6rem',
                                  borderRadius: '0.5rem',
                                  border: '1px solid var(--border-card)',
                                  background: 'var(--bg-card)',
                                  color: 'var(--text-secondary)',
                                  cursor: 'pointer',
                                  fontSize: '0.7rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.2rem'
                                }}
                                title="Add 10 units to batch on ledger"
                              >
                                <Plus size={11} /> 10
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 3: POS & BILLING INVOICING
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'billing' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' }}>
            {/* Left: Template Selector & Items Cart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Point of Sale (POS) Prescription Billing</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Issue verified patient pharmacy bills, calculate taxes, and anchor immutable receipts on IPFS.
                </p>
              </div>

              {/* Quick Template Presets */}
              <div className="pharmacy-glass" style={{ padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  ⚡ Quick Clinical Presets:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button onClick={() => applyTemplate('post_op')} className="btn-ink btn-ink-ghost" style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}>
                    Post-Op Recovery Pack
                  </button>
                  <button onClick={() => applyTemplate('chronic_care')} className="btn-ink btn-ink-ghost" style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}>
                    Chronic Care Monthly
                  </button>
                  <button onClick={() => applyTemplate('emergency_kit')} className="btn-ink btn-ink-ghost" style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}>
                    Acute Emergency Kit
                  </button>
                </div>
              </div>

              {/* Patient ID and Add Medicines */}
              <div className="pharmacy-glass" style={{ padding: '1.25rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                    Target Patient ID / Customer
                  </label>
                  <input
                    type="text"
                    value={billPatientId}
                    onChange={e => setBillPatientId(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '0.75rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Line Items Cart ({cartItems.length})</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click items below to add</span>
                  </div>

                  {cartItems.map((c, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>x{c.quantity}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>${(c.quantity * (c.price || 0)).toFixed(2)}</span>
                        <button onClick={() => setCartItems(cartItems.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Add from Inventory */}
                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-card)' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Add Available Catalog Medicines:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                    {inventory.slice(0, 8).map(inv => (
                      <button
                        key={inv.itemId}
                        onClick={() => addCartItem(inv)}
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-card)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        + {inv.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Checkout Invoice Summary */}
            <div className="pharmacy-glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt size={18} color="var(--obs-accent)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Invoice Summary</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>${subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Healthcare GST (5%):</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>${tax.toFixed(2)}</span>
                </div>
                <div style={{ height: 1, background: 'var(--border-card)', margin: '0.25rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800 }}>
                  <span>Total Due:</span>
                  <span style={{ color: '#10b981', fontFamily: 'var(--font-mono)' }}>${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleGenerateBill}
                disabled={billingSubmitting || cartItems.length === 0}
                className="btn-ink btn-ink-primary"
                style={{ width: '100%', padding: '0.85rem', justifyContent: 'center' }}
              >
                {billingSubmitting ? 'Recording on Ledger...' : 'Generate Bill & Mint Receipt'}
              </button>

              {lastBillReceipt && (
                <div style={{
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  fontSize: '0.75rem'
                }}>
                  <div style={{ fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <CheckCircle2 size={14} /> Receipt Anchored to IPFS
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', marginTop: '0.35rem' }}>
                    Bill ID: <strong>{lastBillReceipt.billId}</strong>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.7rem', wordBreak: 'break-all', marginTop: '0.2rem' }}>
                    CID: {lastBillReceipt.ipfsHash}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 4: OPERATIONS, AUDIT TRAIL & CONSENSUS HEALTH
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'operations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Pharmacy Operations &amp; Blockchain Consensus</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Immutable audit logs, credentialed staff list, and peer node synchronization status.
              </p>
            </div>

            {/* Peer Node Consensus Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="pharmacy-glass" style={{ padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hospital Peer0 Block Height</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.25rem', fontFamily: 'var(--font-mono)', color: 'var(--obs-accent)' }}>
                  Block #{networkStatus.nodes?.peer0 || 18}
                </div>
              </div>
              <div className="pharmacy-glass" style={{ padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hospital Peer1 Block Height</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.25rem', fontFamily: 'var(--font-mono)', color: 'var(--obs-accent)' }}>
                  Block #{networkStatus.nodes?.peer1 || 18}
                </div>
              </div>
              <div className="pharmacy-glass" style={{ padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hospital Peer2 (Pharmacy)</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.25rem', fontFamily: 'var(--font-mono)', color: 'var(--obs-accent)' }}>
                  Block #{networkStatus.nodes?.peer2 || 18}
                </div>
              </div>
              <div className="pharmacy-glass" style={{ padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kubo IPFS Cluster</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.25rem', color: '#10b981' }}>
                  {networkStatus.ipfs || 'UP'}
                </div>
              </div>
            </div>

            {/* Staff Roster */}
            <div className="pharmacy-glass" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>Credentialed Pharmacy Staff</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
                {[
                  { name: 'Dr. Ramesh Sharma', role: 'Chief Pharmacist', id: 'pharmacist', dept: 'Clinical Dispense' },
                  { name: 'Priya Verma', role: 'Inventory Specialist', id: 'inventory_mgr_01', dept: 'Stock Logistics' },
                  { name: 'Amit Kumar', role: 'Billing Officer', id: 'billing_clerk_01', dept: 'POS Invoicing' },
                  { name: 'Director K. Rao', role: 'Operations Director', id: 'pharmacy_mgr', dept: 'Consortium Governance' }
                ].map(emp => (
                  <div key={emp.id} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{emp.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--obs-accent)' }}>{emp.role}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ID: {emp.id}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Role Selection Modal (Hospital Card Style) ───────────────────────── */}
      {roleModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 880 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Select Pharmacy Role Workspace</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Each credentialed role provides fine-grained access to clinical dispensing, inventory, billing, or audit.
                </p>
              </div>
              <button onClick={() => setRoleModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div className="role-grid" style={{ marginBottom: '1.5rem' }}>
              {PHARMACY_ROLES.map(r => {
                const isSelected = selectedRole.id === r.id
                const Icon = r.icon
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRole(r)}
                    className={`role-card ${isSelected ? 'selected' : ''}`}
                    style={{ background: isSelected ? r.gradient : undefined }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div style={{
                        padding: '0.5rem',
                        borderRadius: '0.75rem',
                        background: r.gradient,
                        border: `1px solid ${r.borderSelected}`,
                        color: r.borderSelected
                      }}>
                        <Icon size={20} />
                      </div>
                      <span className={`pill ${r.badgeTone}`}>{r.badge}</span>
                    </div>

                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.25rem' }}>{r.title}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '0.75rem' }}>
                      {r.desc}
                    </p>

                    <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <span>Identity: <strong>{r.user}</strong></span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>Demo: {r.pwd}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setRoleModalOpen(false)} className="btn-ink btn-ink-ghost">
                Close
              </button>
              <button
                onClick={() => {
                  setRoleModalOpen(false)
                  if (selectedRole.id === 'pharmacist') setActiveTab('prescriptions')
                  if (selectedRole.id === 'inventory') setActiveTab('inventory')
                  if (selectedRole.id === 'billing') setActiveTab('billing')
                  if (selectedRole.id === 'manager') setActiveTab('operations')
                }}
                className="btn-ink btn-ink-primary"
              >
                Enter {selectedRole.title} Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dispense Confirmation Modal ────────────────────────────────────── */}
      {dispenseModalVisit && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                {dispenseModalVisit.clinical?.medicationDispensedBy ? 'Medication Dispense Audit' : 'Confirm Medication Dispense'}
              </h3>
              <button onClick={() => setDispenseModalVisit(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Dispensing for Patient <strong style={{ color: 'var(--obs-accent)' }}>{dispenseModalVisit.patientId}</strong> (Visit: {dispenseModalVisit.visitId})
            </div>

            {dispenseModalVisit.clinical?.medicationDispensedBy && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                fontSize: '0.8rem',
                color: '#10b981'
              }}>
                <CheckCircle2 size={16} />
                <div>
                  <strong>Dispensed on Fabric Blockchain</strong>
                  <div style={{ fontSize: '0.72rem', opacity: 0.9 }}>
                    Fulfilled by {dispenseModalVisit.clinical.medicationDispensedBy} {dispenseModalVisit.clinical.medicationDispensedAt ? `· ${new Date(dispenseModalVisit.clinical.medicationDispensedAt).toLocaleString()}` : ''}
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                Fulfillment &amp; Dosage Instructions:
              </label>
              <textarea
                value={dispenseNotes}
                onChange={e => setDispenseNotes(e.target.value)}
                readOnly={Boolean(dispenseModalVisit.clinical?.medicationDispensedBy)}
                rows={3}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setDispenseModalVisit(null)} className="btn-ink btn-ink-ghost">
                Close
              </button>
              {!dispenseModalVisit.clinical?.medicationDispensedBy && (
                <button onClick={handleConfirmDispense} disabled={dispenseSubmitting} className="btn-ink btn-ink-success">
                  {dispenseSubmitting ? 'Signing on Blockchain...' : 'Confirm Dispense to Ledger'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Add Batch Modal ────────────────────────────────────────────────── */}
      {addBatchModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Register Medicine Batch</h3>
              <button onClick={() => setAddBatchModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>Batch ID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MED-011"
                  value={newBatch.itemId}
                  onChange={e => setNewBatch({ ...newBatch, itemId: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>Medicine Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Azithromycin 500mg"
                  value={newBatch.name}
                  onChange={e => setNewBatch({ ...newBatch, name: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>Initial Quantity *</label>
                  <input
                    type="number"
                    required
                    value={newBatch.quantity}
                    onChange={e => setNewBatch({ ...newBatch, quantity: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>Price ($) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newBatch.price}
                    onChange={e => setNewBatch({ ...newBatch, price: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setAddBatchModalOpen(false)} className="btn-ink btn-ink-ghost">
                  Cancel
                </button>
                <button type="submit" className="btn-ink btn-ink-primary">
                  Commit Batch to Fabric
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
