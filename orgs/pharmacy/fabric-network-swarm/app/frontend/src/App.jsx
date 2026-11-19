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
  ArrowLeft,
  UserCheck,
  Trash2,
  DollarSign,
  Activity,
  Layers,
  ChevronRight,
  LogOut,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  User,
  X,
  Clock,
  CheckCircle,
  FolderLock
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'

const PHARMACY_ROLES = [
  {
    id: 'pharmacist',
    title: 'Hospital Dispensing Pharmacist',
    shortTitle: 'Dispensing Pharmacist',
    user: 'pharmacist',
    badge: 'peer2-api (Port 4003)',
    badgeTone: 'pill-info',
    icon: Pill,
    allowedTabs: ['prescriptions', 'inventory', 'patient'],
    defaultTab: 'prescriptions',
    desc: 'In-patient doctor prescription fulfillment, dosage check, and dispensing recorded on the ledger through hospital peer2.',
    gradient: 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(2,132,199,0.06))',
    borderSelected: '#0284c7'
  },
  {
    id: 'inventory',
    title: 'Pharmacy Stock & Inventory Officer',
    shortTitle: 'Stock & Inventory',
    user: 'inventory_mgr_01',
    badge: 'p-backend (Port 3000)',
    badgeTone: 'pill-warn',
    icon: Package,
    allowedTabs: ['inventory'],
    defaultTab: 'inventory',
    desc: 'Pharmaceutical stock registry, batch intake, deductions and reorder alerts (pharmacy store, not on the ledger).',
    gradient: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(217,119,6,0.06))',
    borderSelected: '#f59e0b'
  },
  {
    id: 'billing',
    title: 'Pharmacy POS & Invoicing Clerk',
    shortTitle: 'POS & Billing',
    user: 'billing_clerk_01',
    badge: 'p-backend (Port 3000)',
    badgeTone: 'pill-ok',
    icon: FileText,
    allowedTabs: ['billing', 'patient', 'inventory'],
    defaultTab: 'billing',
    desc: 'Point-of-sale customer billing, template packs, 5% GST and a bill document saved to IPFS.',
    gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.06))',
    borderSelected: '#10b981'
  },
  {
    id: 'manager',
    title: 'Pharmacy Director & Operations Manager',
    shortTitle: 'Director & Operations',
    user: 'pharmacy_mgr',
    badge: 'p-backend (Port 3000)',
    badgeTone: 'pill-danger',
    icon: ShieldCheck,
    allowedTabs: ['inventory', 'billing', 'patient', 'operations'],
    defaultTab: 'operations',
    desc: 'Staff list, bill audit and full access to every pharmacy module.',
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
      { name: 'Metformin 850mg', quantity: 60, price: 22.0 },
      { name: 'Atorvastatin 20mg', quantity: 30, price: 18.5 },
      { name: 'Lisinopril 10mg', quantity: 30, price: 14.0 }
    ]
  },
  emergency_kit: {
    name: 'Acute Emergency Kit',
    medicines: [
      { name: 'Epinephrine Auto-Injector', quantity: 2, price: 85.0 },
      { name: 'Salbutamol Inhaler 100mcg', quantity: 1, price: 25.0 },
      { name: 'Hydrocortisone 100mg Injection', quantity: 4, price: 32.0 }
    ]
  },
  custom: {
    name: 'Custom Prescription',
    medicines: []
  }
}

const SESSION_KEY = 'caregrid_pharmacy_session'

function sessionToken() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))?.token || ''
  } catch {
    return ''
  }
}

// Every pharmacy and hospital API call carries the signed-in staff token.
function apiFetch(url, opts = {}) {
  return fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${sessionToken()}` } })
}

async function readError(res, fallback) {
  try {
    const d = await res.json()
    return d.message || d.error || fallback
  } catch {
    return fallback
  }
}

// A prescription is the object written by the doctor portal:
// { version, medications: [..], instructions, prescribedBy, prescribedAt }
function prescriptionText(rx) {
  if (!rx) return ''
  if (typeof rx === 'string') return rx
  const meds = Array.isArray(rx.medications) ? rx.medications.join(', ') : String(rx.medications || '')
  return rx.instructions ? `${meds} (${rx.instructions})` : meds
}

const TABS = [
  { id: 'prescriptions', label: 'Doctor Orders & Dispense', icon: Pill },
  { id: 'inventory', label: 'Stock & Inventory', icon: Package },
  { id: 'billing', label: 'POS Billing & Prescriptions', icon: FileText },
  { id: 'patient', label: 'Patient Medical Records', icon: User },
  { id: 'operations', label: 'Operations & Staff Workforce', icon: ShieldCheck }
]

export default function App() {
  // Session & Role Auth State (Zero-Trust: Null session requires role authentication)
  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Invalidate legacy mock auto-granted tokens
        if (parsed.token && parsed.token !== 'init_token_pharm') {
          return parsed
        }
        localStorage.removeItem(SESSION_KEY)
      }
    } catch {}
    return null
  })

  const [selectedRole, setSelectedRole] = useState(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const match = PHARMACY_ROLES.find(r => r.id === parsed.role)
        if (match) return match
      }
    } catch {}
    return PHARMACY_ROLES[0]
  })

  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [pendingRole, setPendingRole] = useState(PHARMACY_ROLES[0])
  const [authUsername, setAuthUsername] = useState(PHARMACY_ROLES[0].user)
  const [authPassword, setAuthPassword] = useState('')
  const [showAuthPass, setShowAuthPass] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Active Tab
  const [activeTab, setActiveTab] = useState('prescriptions')
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleSelectPendingRole = (role) => {
    setPendingRole(role)
    setAuthUsername(role.user)
    setAuthPassword('')
    setAuthError('')
  }

  const handleRoleAuthenticate = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      const res = await fetch('/api/hospital/peer2/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authUsername.trim(),
          password: authPassword.trim()
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Invalid username or password for this role')
      }

      const token = data.data?.token
      const serverRole = data.data?.user?.role
      if (!token) throw new Error('Login did not return a session token')
      // The workspace follows the role on the account, not the card that was clicked.
      const grantedRole = PHARMACY_ROLES.find(r => r.id === serverRole)
      if (!grantedRole) throw new Error(`Account '${authUsername.trim()}' has role '${serverRole}', which has no pharmacy workspace`)
      const newSession = {
        username: authUsername.trim(),
        role: grantedRole.id,
        title: grantedRole.title,
        shortTitle: grantedRole.shortTitle,
        token
      }

      setSession(newSession)
      localStorage.setItem(SESSION_KEY, JSON.stringify(newSession))
      setSelectedRole(grantedRole)
      setRoleModalOpen(false)
      setAuthPassword('')

      if (!grantedRole.allowedTabs?.includes(activeTab)) {
        setActiveTab(grantedRole.defaultTab || 'inventory')
      }

      showToast(`Signed in as ${grantedRole.title} (${authUsername.trim()})`, 'success')
    } catch (err) {
      setAuthError(err.message || 'Authentication failed. Please verify credentials.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignOut = () => {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    setRoleModalOpen(false)
    showToast('Signed out of Pharmacy Operations Suite. Workspace locked.', 'info')
  }

  // Common Network Telemetry
  const [networkStatus, setNetworkStatus] = useState({ service: 'UNKNOWN', ipfs: 'UNKNOWN', ledger: false })

  // 1. Prescriptions State (Hospital Peer2 Visits)
  const [hospitalVisits, setHospitalVisits] = useState([])
  const [visitsLoading, setVisitsLoading] = useState(false)
  const [visitsError, setVisitsError] = useState('')
  const [dispenseModalVisit, setDispenseModalVisit] = useState(null)
  const [dispenseNotes, setDispenseNotes] = useState('')
  const [dispenseSubmitting, setDispenseSubmitting] = useState(false)

  // 2. Inventory State
  const [inventory, setInventory] = useState([])
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [inventorySearch, setInventorySearch] = useState('')
  const [addBatchModalOpen, setAddBatchModalOpen] = useState(false)
  const [newBatch, setNewBatch] = useState({ itemId: '', name: '', quantity: 100, price: 10, unit: 'tablets' })

  // 3. Billing POS State
  const [billPatientId, setBillPatientId] = useState('')
  const [cartItems, setCartItems] = useState([])
  const [customAmount, setCustomAmount] = useState('')
  const [billingSubmitting, setBillingSubmitting] = useState(false)
  const [lastBillReceipt, setLastBillReceipt] = useState(null)

  // 4. Patient Medical Records State
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [customPatientInput, setCustomPatientInput] = useState('')
  const [patientProfile, setPatientProfile] = useState(null)
  const [patientBills, setPatientBills] = useState([])
  const [patientAccessList, setPatientAccessList] = useState([])
  const [patientLoading, setPatientLoading] = useState(false)
  const [newRequesterId, setNewRequesterId] = useState('')
  const [accessActionLoading, setAccessActionLoading] = useState(false)

  // 5. Operations & Workforce State
  const [auditBills, setAuditBills] = useState([])
  const [employees, setEmployees] = useState([])
  const [opsLoading, setOpsLoading] = useState(false)
  const [newEmp, setNewEmp] = useState({ userId: '', name: '', role: 'billing', dept: 'Clinical Dispense' })
  const [onboardLoading, setOnboardLoading] = useState(false)

  // Fetch Telemetry
  const fetchTelemetry = async () => {
    try {
      const res = await fetch('/api/pharmacy/api/network-status').catch(() => null)
      if (res && res.ok) {
        const d = await res.json()
        setNetworkStatus(d)
      }
    } catch {}
  }

  // Fetch Inventory
  const fetchInventory = async () => {
    setInventoryLoading(true)
    try {
      const res = await apiFetch('/api/pharmacy/api/inventory').catch(() => null)
      if (res && res.ok) {
        const d = await res.json()
        if (Array.isArray(d)) setInventory(d)
      }
    } catch (e) {
      console.warn('Inventory fetch error:', e)
    } finally {
      setInventoryLoading(false)
    }
  }

  // Fetch Hospital Prescriptions from Peer2
  const fetchHospitalVisits = async () => {
    // Only the dispensing pharmacist identity can read prescriptions on peer2.
    if (session?.role !== 'pharmacist') {
      setHospitalVisits([])
      return
    }
    setVisitsLoading(true)
    setVisitsError('')
    try {
      const visitsRes = await apiFetch('/api/hospital/peer2/pharmacist/visits')
      if (!visitsRes.ok) throw new Error(await readError(visitsRes, `Hospital peer2 returned ${visitsRes.status}`))
      const list = await visitsRes.json()
      const rows = Array.isArray(list) ? list : (list.data || list.visits || [])

      const fullVisits = await Promise.all(
        rows.map(async v => {
          const det = await apiFetch(`/api/hospital/peer2/pharmacist/visits/${v.visitId}`)
          if (!det.ok) return v
          const body = await det.json()
          return body.data || body
        })
      )
      setHospitalVisits(fullVisits.filter(v => v?.clinical?.prescriptions?.length > 0))
    } catch (err) {
      setHospitalVisits([])
      setVisitsError(err.message)
    } finally {
      setVisitsLoading(false)
    }
  }

  // Fetch Operations Data
  const fetchOpsData = async () => {
    setOpsLoading(true)
    try {
      const [audRes, empRes] = await Promise.all([
        apiFetch('/api/pharmacy/api/bills/audit').catch(() => null),
        apiFetch('/api/pharmacy/api/employees').catch(() => null)
      ])
      if (audRes && audRes.ok) {
        const a = await audRes.json()
        if (Array.isArray(a)) setAuditBills(a)
      }
      if (empRes && empRes.ok) {
        const e = await empRes.json()
        if (Array.isArray(e)) setEmployees(e)
      }
    } catch (err) {
      console.warn('Ops data fetch error:', err)
    } finally {
      setOpsLoading(false)
    }
  }

  // Fetch Patient Medical Records
  const fetchPatientData = async (patId) => {
    if (!patId) return
    setPatientLoading(true)
    try {
      const [profRes, billsRes, accRes] = await Promise.all([
        apiFetch(`/api/pharmacy/api/patient/${patId}`).then(r => r.ok ? r.json() : null).catch(() => null),
        apiFetch(`/api/pharmacy/api/bills/patient/${patId}`).then(r => r.ok ? r.json() : []).catch(() => []),
        apiFetch(`/api/pharmacy/api/patient/${patId}/access-list`).then(r => r.ok ? r.json() : []).catch(() => [])
      ])
      setPatientProfile(profRes)
      setPatientBills(Array.isArray(billsRes) ? billsRes : [])
      setPatientAccessList(Array.isArray(accRes) ? accRes : [])
    } catch (err) {
      console.warn('Patient data fetch error:', err)
    } finally {
      setPatientLoading(false)
    }
  }

  useEffect(() => {
    fetchTelemetry()
    if (session) {
      fetchInventory()
      fetchHospitalVisits()
      fetchOpsData()
      fetchPatientData(selectedPatientId)
    }
  }, [session])

  useEffect(() => {
    if (!session) return
    if (activeTab === 'patient') {
      fetchPatientData(selectedPatientId)
    } else if (activeTab === 'operations') {
      fetchOpsData()
    } else if (activeTab === 'inventory') {
      fetchInventory()
    } else if (activeTab === 'prescriptions') {
      fetchHospitalVisits()
    }
  }, [activeTab, selectedPatientId, session])

  // Dispense Handler
  const handleConfirmDispense = async () => {
    if (!dispenseModalVisit) return
    const prescriptions = dispenseModalVisit.clinical?.prescriptions || []
    const latest = prescriptions[prescriptions.length - 1]
    if (!latest) {
      showToast('This visit has no prescription to dispense', 'error')
      return
    }
    setDispenseSubmitting(true)
    try {
      const medicationDetails = typeof latest === 'string' ? latest : JSON.stringify(latest)
      const res = await apiFetch(`/api/hospital/peer2/pharmacist/visits/${dispenseModalVisit.visitId}/dispense`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicationDetails, notes: dispenseNotes })
      })
      if (!res.ok) throw new Error(await readError(res, 'Dispense transaction was rejected by hospital peer2'))

      showToast(`Dispense for ${dispenseModalVisit.patientId} recorded on the ledger. Deduct the stock in Inventory.`, 'success')
      setDispenseModalVisit(null)
      setDispenseNotes('')
      fetchHospitalVisits()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setDispenseSubmitting(false)
    }
  }

  // Quick Deduct (-1)
  const handleQuickDeduct = async (itemId) => {
    try {
      const res = await apiFetch('/api/pharmacy/api/inventory/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, quantity: 1 })
      })
      if (!res.ok) throw new Error(await readError(res, 'Deduction failed'))
      showToast(`1 unit deducted for ${itemId}`, 'info')
      fetchInventory()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  // Quick Restock (+10)
  const handleQuickRestock = async (item) => {
    try {
      const res = await apiFetch('/api/pharmacy/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.itemId,
          name: item.name,
          quantity: 10,
          price: item.price,
          unit: item.unit || 'tablets'
        })
      })
      if (!res.ok) throw new Error(await readError(res, 'Restock failed'))
      showToast(`10 units restocked for ${item.name}!`, 'success')
      fetchInventory()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  // Create Batch
  const handleCreateBatch = async (e) => {
    e.preventDefault()
    try {
      const res = await apiFetch('/api/pharmacy/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newBatch,
          quantity: Number(newBatch.quantity),
          price: Number(newBatch.price)
        })
      })
      if (!res.ok) throw new Error(await readError(res, 'Failed to save the batch'))
      showToast(`New batch for ${newBatch.name} saved to pharmacy stock`, 'success')
      setAddBatchModalOpen(false)
      setNewBatch({ itemId: '', name: '', quantity: 100, price: 10, unit: 'tablets' })
      fetchInventory()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  // Billing Templates
  const applyTemplate = (key) => {
    const t = PRESCRIPTION_TEMPLATES[key]
    if (!t) return
    if (key === 'custom') {
      setCartItems([{ name: '', quantity: 1, price: 10 }])
    } else {
      setCartItems([...t.medicines])
    }
    showToast(`Applied template: ${t.name}`, 'info')
  }

  const addCustomCartItem = () => {
    setCartItems([...cartItems, { name: '', quantity: 1, price: 10 }])
  }

  const removeCartItem = (idx) => {
    setCartItems(cartItems.filter((_, i) => i !== idx))
  }

  const updateCartItem = (idx, field, val) => {
    const items = [...cartItems]
    items[idx][field] = val
    setCartItems(items)
  }

  const subtotalAmount = cartItems.reduce((acc, i) => acc + (Number(i.quantity) || 1) * (Number(i.price) || 0), 0)
  const gstAmount = subtotalAmount * 0.05
  const totalAmount = customAmount ? Number(customAmount) : (subtotalAmount + gstAmount)

  // Generate POS Bill
  const handleGenerateBill = async () => {
    if (!billPatientId.trim()) {
      showToast('Please specify a patient UID', 'error')
      return
    }
    if (cartItems.length === 0) {
      showToast('Please add at least one line item', 'error')
      return
    }
    setBillingSubmitting(true)
    try {
      const res = await apiFetch('/api/pharmacy/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: billPatientId.trim(),
          amount: Number(totalAmount.toFixed(2)),
          medicineList: cartItems.map(m => {
            const stock = inventory.find(i => i.name && i.name.trim().toLowerCase() === String(m.name).trim().toLowerCase())
            return { itemId: stock?.itemId, name: m.name, quantity: String(m.quantity), price: Number(m.price) || 0 }
          })
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Billing submission failed')
      setLastBillReceipt(data)
      showToast('Bill saved. The bill document is pinned to IPFS; stock was deducted for items that match inventory.', 'success')
      fetchOpsData()
      fetchInventory()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBillingSubmitting(false)
    }
  }

  // Onboard Staff Handler
  const handleRegisterEmployee = async (e) => {
    e.preventDefault()
    if (!newEmp.userId.trim() || !newEmp.name.trim()) return
    setOnboardLoading(true)
    try {
      const res = await apiFetch('/api/pharmacy/api/register-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newEmp.userId.trim(),
          role: newEmp.role,
          name: newEmp.name.trim(),
          metadata: { dept: newEmp.dept }
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Staff registration failed')
      showToast(`${newEmp.name} (${newEmp.userId}) added to the pharmacy staff list`, 'success')
      setNewEmp({ userId: '', name: '', role: 'billing', dept: 'Clinical Dispense' })
      fetchOpsData()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setOnboardLoading(false)
    }
  }

  // Grant Access Handler
  const handleGrantAccess = async (e) => {
    e.preventDefault()
    if (!newRequesterId.trim()) return
    setAccessActionLoading(true)
    try {
      const res = await apiFetch('/api/pharmacy/api/grant-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatientId,
          requesterId: newRequesterId.trim()
        })
      })
      if (!res.ok) throw new Error(await readError(res, 'Failed to update the access list'))
      showToast(`Access granted to ${newRequesterId.trim()}`, 'success')
      setNewRequesterId('')
      fetchPatientData(selectedPatientId)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setAccessActionLoading(false)
    }
  }

  // Revoke Access Handler
  const handleRevokeAccess = async (requesterId) => {
    setAccessActionLoading(true)
    try {
      const res = await apiFetch('/api/pharmacy/api/revoke-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatientId,
          requesterId
        })
      })
      if (!res.ok) throw new Error(await readError(res, 'Failed to update the access list'))
      showToast(`Revoked access for ${requesterId}`, 'info')
      fetchPatientData(selectedPatientId)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setAccessActionLoading(false)
    }
  }

  // Filtered inventory
  const filteredInventory = inventory.filter(i => {
    if (!inventorySearch.trim()) return true
    const q = inventorySearch.toLowerCase()
    return (i.name && i.name.toLowerCase().includes(q)) || (i.itemId && i.itemId.toLowerCase().includes(q))
  })

  // RBAC Tab Restriction View
  const renderRbacGate = (requiredRole, tabName) => (
    <div className="pharmacy-glass" style={{
      padding: '4rem 2rem',
      textAlign: 'center',
      maxWidth: 580,
      margin: '2rem auto',
      borderRadius: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: 'rgba(239, 68, 68, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.5rem',
        color: '#ef4444'
      }}>
        <Lock size={32} />
      </div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
        Access Restricted by RBAC Policy
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: 440, lineHeight: 1.6, marginBottom: '1.5rem' }}>
        The <strong>{tabName}</strong> module requires authorized privileges for <strong>{requiredRole.title}</strong>. Your current authenticated session is restricted to {selectedRole.title} operations.
      </p>
      <div style={{
        padding: '0.75rem 1.25rem',
        borderRadius: '0.75rem',
        background: 'var(--bg-page)',
        border: '1px solid var(--border-card)',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        marginBottom: '1.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <KeyRound size={14} color="#f59e0b" />
        <span>Required Gateway Identity: <strong style={{ color: 'var(--text-primary)' }}>{requiredRole.user}</strong> ({requiredRole.badge})</span>
      </div>
      <button
        onClick={() => {
          handleSelectPendingRole(requiredRole)
          setRoleModalOpen(true)
        }}
        className="btn-ink btn-ink-primary"
        style={{ padding: '0.65rem 1.5rem', fontSize: '0.85rem', gap: '0.5rem' }}
      >
        <Lock size={15} />
        <span>Authenticate as {requiredRole.title}</span>
      </button>
    </div>
  )

  // ── Unauthenticated State: Role Authentication & Security Gate ──
  if (!session) {
    return (
      <div className="pharmacy-app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Toast Notification */}
        {toast && (
          <div style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : toast.type === 'info' ? 'rgba(2, 132, 199, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            color: '#ffffff',
            padding: '0.75rem 1.25rem',
            borderRadius: '0.75rem',
            backdropFilter: 'blur(12px)',
            fontWeight: 600,
            fontSize: '0.85rem',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            <span>{toast.msg}</span>
          </div>
        )}

        {/* Top Navbar (Auth Gate Mode) */}
        <header className="pharm-navbar">
          <div className="brand-group">
            <div className="brand-icon">
              <img src="/logo.svg" alt="CareGrid NITW" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="brand-title">CareGrid <span style={{ color: 'var(--obs-accent)' }}>Pharmacy</span></span>
                <span className="brand-badge">Suite</span>
              </div>
              <p className="brand-sub">NIT Warangal Campus Health Center · Pharmacy</p>
            </div>
          </div>

          <div className="header-actions">
            <a
              href="http://localhost/"
              className="btn-ink btn-ink-ghost"
              style={{ fontSize: '0.78rem', padding: '0.45rem 0.95rem', gap: '0.4rem', textDecoration: 'none' }}
            >
              <ArrowLeft size={14} />
              <span>Consortium Hub</span>
            </a>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.85rem',
              borderRadius: '9999px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              <Lock size={12} />
              <span>Role Authentication Required</span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.85rem',
              borderRadius: '9999px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              fontSize: '0.75rem'
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: networkStatus.ipfs === 'UP' ? '#10b981' : '#f59e0b' }} />
              <span style={{ color: 'var(--text-muted)' }}>IPFS:</span>
              <strong>{networkStatus.ipfs || 'UNKNOWN'}</strong>
            </div>

            <ThemeToggle />
          </div>
        </header>

        {/* Main Authentication Content */}
        <main style={{ maxWidth: 1040, margin: '1.5rem auto 3rem', padding: '0 1.5rem', flex: 1, width: '100%' }}>
          {/* Security Banner */}
          <div className="pharmacy-glass" style={{
            padding: '1rem 1.5rem',
            borderRadius: '1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            borderLeft: '4px solid var(--obs-accent)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '0.75rem',
                background: 'rgba(14,165,233,0.12)',
                color: 'var(--obs-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ShieldCheck size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                  CareGrid Pharmacy Role Authentication &amp; Access Gate
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
                  Sign in with a pharmacy staff account issued by Hospital Administration.
                </p>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.75rem',
              padding: '0.35rem 0.85rem',
              borderRadius: '9999px',
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.25)',
              color: '#10b981',
              fontWeight: 600
            }}>
              <CheckCircle2 size={13} />
              <span>Staff sign-in required</span>
            </div>
          </div>

          {/* Role Cards Grid */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>1. Select Your Credentialed Role</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Choose the operational role that matches your hospital or pharmacy assignment.
                </p>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Target: <strong style={{ color: 'var(--obs-accent)' }}>{pendingRole.title}</strong>
              </span>
            </div>

            <div className="role-grid">
              {PHARMACY_ROLES.map(r => {
                const isSelected = pendingRole.id === r.id
                const Icon = r.icon
                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectPendingRole(r)}
                    className={`role-card ${isSelected ? 'selected' : ''}`}
                    style={{
                      background: isSelected ? r.gradient : 'var(--bg-card)',
                      borderColor: isSelected ? r.borderSelected : 'var(--border-card)',
                      cursor: 'pointer'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: '0.75rem',
                          background: isSelected ? r.borderSelected : 'rgba(255,255,255,0.06)',
                          color: isSelected ? 'white' : 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Icon size={19} />
                        </div>
                        <span className={`status-pill ${r.badgeTone}`} style={{ fontSize: '0.62rem' }}>
                          {r.badge}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                        {r.title}
                      </h4>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '0.75rem' }}>
                        {r.desc}
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-card)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Account:</span>
                        <code style={{ color: 'var(--obs-accent)', fontWeight: 600 }}>{r.user}</code>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.72rem' }}>
                        {isSelected ? (
                          <span style={{ color: r.borderSelected, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle2 size={13} /> Active Target
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Select Role →</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Credential Verification Form */}
          <form onSubmit={handleRoleAuthenticate} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            borderRadius: '1.25rem',
            padding: '1.75rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <KeyRound size={20} color="var(--obs-accent)" />
                <div>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0 }}>
                    2. Authenticate &amp; Unlock Workspace for {pendingRole.title}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                    Sign in with your hospital staff account. The workspace opens for the role on that account.
                  </p>
                </div>
              </div>
              <span className="status-pill pill-info" style={{ fontSize: '0.68rem' }}>
                Gateway: {pendingRole.badge}
              </span>
            </div>

            {authError && (
              <div style={{
                padding: '0.75rem 1.25rem',
                borderRadius: '0.75rem',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.8rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertTriangle size={16} />
                <span>{authError}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  Username
                </label>
                <input
                  type="text"
                  value={authUsername}
                  onChange={e => setAuthUsername(e.target.value)}
                  placeholder="e.g. pharmacist"
                  required
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.95rem',
                    borderRadius: '0.65rem',
                    border: '1px solid var(--border-card)',
                    background: 'var(--bg-page)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
                <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>Account for this role:</span>
                  <button
                    type="button"
                    onClick={() => setAuthUsername(pendingRole.user)}
                    style={{ background: 'none', border: 'none', color: 'var(--obs-accent)', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontFamily: 'var(--font-mono)' }}
                  >
                    {pendingRole.user}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  Password / Passphrase
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showAuthPass ? 'text' : 'password'}
                    value={authPassword}
                    onChange={e => setAuthPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    style={{
                      width: '100%',
                      padding: '0.7rem 2.4rem 0.7rem 0.95rem',
                      borderRadius: '0.65rem',
                      border: '1px solid var(--border-card)',
                      background: 'var(--bg-page)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthPass(!showAuthPass)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    {showAuthPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <a
                href="http://localhost/"
                className="btn-ink btn-ink-ghost"
                style={{ fontSize: '0.8rem', padding: '0.6rem 1.1rem', gap: '0.4rem', textDecoration: 'none' }}
              >
                <ArrowLeft size={14} />
                <span>Cancel &amp; Return to Consortium Hub</span>
              </a>

              <button
                type="submit"
                disabled={authLoading}
                className="btn-ink btn-ink-primary"
                style={{ fontSize: '0.85rem', padding: '0.65rem 1.6rem', gap: '0.5rem' }}
              >
                {authLoading ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Authenticate &amp; Enter {pendingRole.title} Workspace →</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </main>
      </div>
    )
  }

  return (
    <div className="pharmacy-app">
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : toast.type === 'info' ? 'rgba(2, 132, 199, 0.95)' : 'rgba(16, 185, 129, 0.95)',
          color: '#ffffff',
          padding: '0.75rem 1.25rem',
          borderRadius: '0.75rem',
          backdropFilter: 'blur(12px)',
          fontWeight: 600,
          fontSize: '0.85rem',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="pharm-navbar">
        <div className="brand-group">
          <div className="brand-icon">
            <img src="/logo.svg" alt="CareGrid NITW" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="brand-title">CareGrid <span style={{ color: 'var(--obs-accent)' }}>Pharmacy</span></span>
              <span className="brand-badge">Suite</span>
            </div>
            <p className="brand-sub">NIT Warangal Campus Health Center · Pharmacy</p>
          </div>
        </div>

        <div className="header-actions">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.35rem 0.8rem',
            borderRadius: '9999px',
            border: '1px solid var(--border-card)',
            background: 'var(--bg-card)',
            fontSize: '0.74rem',
            whiteSpace: 'nowrap'
          }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 6px #10b981'
            }} />
            <span><strong style={{ color: 'var(--obs-accent)' }}>{session.username}</strong></span>
            <span style={{ color: 'var(--text-muted)' }}>· {session.shortTitle || selectedRole.shortTitle || selectedRole.title}</span>
          </div>

          <button
            onClick={() => {
              setPendingRole(selectedRole)
              setAuthUsername(selectedRole.user)
              setAuthPassword('')
              setAuthError('')
              setRoleModalOpen(true)
            }}
            className="btn-ink btn-ink-primary"
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.95rem' }}
          >
            <ShieldCheck size={14} />
            <span>Switch Role</span>
          </button>

          <button
            onClick={handleSignOut}
            className="btn-ink btn-ink-ghost"
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem', gap: '0.35rem', color: '#ef4444' }}
            title="Lock workspace and sign out"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '9999px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            fontSize: '0.75rem'
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: networkStatus.ipfs === 'UP' ? '#10b981' : '#f59e0b' }} />
            <span style={{ color: 'var(--text-muted)' }}>IPFS:</span>
            <strong>{networkStatus.ipfs || 'UNKNOWN'}</strong>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* Subheader Navigation Bar */}
      <div style={{
        maxWidth: 1440,
        margin: '1.25rem auto 0',
        padding: '0 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <nav className="tab-pill-bar">
          {TABS.map(t => {
            const Icon = t.icon
            const isAllowed = selectedRole.allowedTabs?.includes(t.id)
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`tab-pill ${activeTab === t.id ? 'active' : ''}`}
                style={{
                  opacity: isAllowed ? 1 : 0.65,
                  position: 'relative'
                }}
              >
                <Icon size={14} />
                <span>{t.label}</span>
                {!isAllowed && (
                  <Lock size={11} style={{ marginLeft: 2, color: 'var(--text-muted)' }} />
                )}
              </button>
            )
          })}
        </nav>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span>Gateway:</span>
          <code style={{ color: 'var(--obs-accent)', fontWeight: 600 }}>{selectedRole.badge}</code>
        </div>
      </div>

      {/* Main Content Workspace */}
      <main style={{ maxWidth: 1440, margin: '1.25rem auto 3rem', padding: '0 2rem', flex: 1, width: '100%' }}>

        {/* ── Tab 1: Doctor Prescriptions & Dispensing (Pharmacist / Manager) ── */}
        {activeTab === 'prescriptions' && (
          selectedRole.allowedTabs?.includes('prescriptions') ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>In-Patient Prescriptions from Hospital Doctors</h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Prescriptions on finalized visits, read from the ledger and IPFS through hospital peer2.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={fetchHospitalVisits} className="btn-ink btn-ink-ghost" style={{ fontSize: '0.75rem', gap: '0.4rem' }}>
                    <RefreshCw size={13} className={visitsLoading ? 'animate-spin' : ''} />
                    <span>Refresh Queue</span>
                  </button>
                </div>
              </div>

              {visitsLoading ? (
                <div className="pharmacy-glass" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading prescriptions from hospital peer2...
                </div>
              ) : visitsError ? (
                <div className="pharmacy-glass" style={{ padding: '2rem', textAlign: 'center', color: '#ef4444', fontSize: '0.85rem' }}>
                  Could not load prescriptions: {visitsError}
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
                    const presc = prescriptionText(v.clinical?.prescriptions?.[v.clinical.prescriptions.length - 1])
                    const isDispensed = Boolean(v.clinical?.medicationDispensedBy || v.clinical?.medicationDetails)

                    return (
                      <div key={v.visitId} className="pharmacy-glass" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <div>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem' }}>{v.visitId}</span>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Patient UID: <strong>{v.patientId}</strong></div>
                            </div>
                            <span className={`status-pill ${isDispensed ? 'pill-ok' : 'pill-warn'}`}>
                              {isDispensed ? 'Dispensed on Ledger' : 'Awaiting Dispense'}
                            </span>
                          </div>

                          <div style={{ padding: '0.75rem', borderRadius: '0.75rem', background: 'var(--bg-page)', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Clinical Order:</div>
                            <div style={{ fontWeight: 600, color: 'var(--obs-accent)', marginTop: '0.2rem' }}>
                              {presc}
                            </div>
                            {v.clinical?.diagnosis && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                                Diagnosis: {v.clinical.diagnosis}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            <span>Doctor: <strong>{v.assignedDoctor || '-'}</strong></span>
                            <span>{v.updatedAt ? new Date(v.updatedAt).toLocaleDateString() : ''}</span>
                          </div>
                        </div>

                        <div>
                          {isDispensed ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>
                              <CheckCircle2 size={15} />
                              <span>Dispensed by {v.clinical?.medicationDispensedBy}</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setDispenseModalVisit(v)
                                setDispenseNotes('')
                              }}
                              className="btn-ink btn-ink-primary"
                              style={{ width: '100%', fontSize: '0.8rem', padding: '0.55rem' }}
                            >
                              <ShieldCheck size={14} />
                              <span>Fulfill & Dispense to Patient</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : renderRbacGate(PHARMACY_ROLES[0], 'Doctor Orders & Clinical Dispensing')
        )}

        {/* ── Tab 2: Stock & Inventory Catalog (Inventory / Pharmacist / Manager) ── */}
        {activeTab === 'inventory' && (
          selectedRole.allowedTabs?.includes('inventory') ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Pharmaceutical Stock &amp; Inventory</h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Stock levels and batches kept in the pharmacy store. These records are not on the ledger.
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
                  placeholder="Filter stock by SKU or Medicine Name..."
                  value={inventorySearch}
                  onChange={e => setInventorySearch(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                />
              </div>

              {/* Live Inventory Table */}
              <div className="pharmacy-glass" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="pharmacy-table">
                  <thead>
                    <tr>
                      <th>SKU / Item ID</th>
                      <th>Medicine Name</th>
                      <th>Stock Quantity</th>
                      <th>Unit Price</th>
                      <th>Last Sync</th>
                      <th>Status</th>
                      <th>Fast Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map(item => {
                      const qty = Number(item.quantity) || 0
                      const isLow = qty < 80
                      return (
                        <tr key={item.itemId}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--obs-accent)' }}>{item.itemId}</td>
                          <td style={{ fontWeight: 600 }}>{item.name}</td>
                          <td>
                            <strong>{qty}</strong> <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.unit || 'tablets'}</span>
                          </td>
                          <td style={{ color: '#10b981', fontWeight: 700 }}>${Number(item.price || 0).toFixed(2)}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : '-'}</td>
                          <td>
                            <span className={`status-pill ${isLow ? 'pill-warn' : 'pill-ok'}`}>
                              {isLow ? 'Low Stock' : 'Optimal'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button
                                onClick={() => handleQuickDeduct(item.itemId)}
                                title="Deduct 1 unit"
                                className="btn-ink btn-ink-ghost"
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}
                              >
                                <Minus size={11} /> 1
                              </button>
                              <button
                                onClick={() => handleQuickRestock(item)}
                                title="Add 10 units"
                                className="btn-ink btn-ink-ghost"
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}
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
          ) : renderRbacGate(PHARMACY_ROLES[1], 'Pharmaceutical Stock & Inventory')
        )}

        {/* ── Tab 3: POS Billing & Prescriptions (Billing / Manager) ── */}
        {activeTab === 'billing' && (
          selectedRole.allowedTabs?.includes('billing') ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Point of Sale (POS) Prescription Billing</h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Create a pharmacy bill. The bill document is pinned to IPFS; the bill record is kept in the pharmacy store.
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
                    <button onClick={() => applyTemplate('custom')} className="btn-ink btn-ink-ghost" style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}>
                      + Custom Item
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
                      <button onClick={addCustomCartItem} className="btn-ink btn-ink-ghost" style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}>
                        <Plus size={12} /> Add Item
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {cartItems.map((item, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 90px 32px', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            placeholder="Medicine Name"
                            value={item.name}
                            onChange={e => updateCartItem(idx, 'name', e.target.value)}
                            style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                          />
                          <input
                            type="number"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={e => updateCartItem(idx, 'quantity', e.target.value)}
                            style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                          />
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Price"
                            value={item.price}
                            onChange={e => updateCartItem(idx, 'price', e.target.value)}
                            style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                          />
                          <button
                            onClick={() => removeCartItem(idx)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Checkout Summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="pharmacy-glass" style={{ padding: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem' }}>Invoicing Summary</h3>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Items Subtotal</span>
                    <span>${subtotalAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Healthcare GST (5%)</span>
                    <span>${gstAmount.toFixed(2)}</span>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: '0.75rem', marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>Total Payable</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
                      ${totalAmount.toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={handleGenerateBill}
                    disabled={billingSubmitting}
                    className="btn-ink btn-ink-primary"
                    style={{ width: '100%', marginTop: '1.25rem', padding: '0.75rem', fontSize: '0.85rem' }}
                  >
                    {billingSubmitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Saving bill...</span>
                      </>
                    ) : (
                      <>
                        <Receipt size={15} />
                        <span>Create Bill</span>
                      </>
                    )}
                  </button>
                </div>

                {lastBillReceipt && (
                  <div className="pharmacy-glass" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      <CheckCircle2 size={16} />
                      <span>Bill Saved</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bill ID:</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--obs-accent)', marginBottom: '0.5rem' }}>
                      {lastBillReceipt.billId}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>IPFS Hash:</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#10b981', wordBreak: 'break-all', marginBottom: '0.75rem' }}>
                      {lastBillReceipt.ipfsHash}
                    </div>
                    <a
                      href={`http://localhost:8090/ipfs/${lastBillReceipt.ipfsHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ink btn-ink-ghost"
                      style={{ fontSize: '0.75rem', width: '100%', justifyContent: 'center' }}
                    >
                      <ExternalLink size={13} />
                      <span>View Raw IPFS Receipt</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : renderRbacGate(PHARMACY_ROLES[2], 'POS Billing & Prescriptions')
        )}

        {/* ── Tab 4: Patient Medical Records (Pharmacist / Billing / Manager) ── */}
        {activeTab === 'patient' && (
          selectedRole.allowedTabs?.includes('patient') ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Patient Pharmacy Records</h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Pharmacy bills and the pharmacy access list for one patient ID. Hospital records are not shown here.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => fetchPatientData(selectedPatientId)} className="btn-ink btn-ink-ghost" style={{ fontSize: '0.75rem' }}>
                    <RefreshCw size={14} className={patientLoading ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Patient Selector Pills + Custom Search */}
              <div className="pharmacy-glass" style={{ padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Select or Search Patient UID:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto' }}>
                    <input
                      type="text"
                      placeholder="Patient ID"
                      value={customPatientInput}
                      onChange={e => setCustomPatientInput(e.target.value)}
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-card)',
                        background: 'var(--bg-page)',
                        color: 'var(--text-primary)',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)'
                      }}
                    />
                    <button
                      onClick={() => {
                        if (customPatientInput.trim()) {
                          setSelectedPatientId(customPatientInput.trim())
                          fetchPatientData(customPatientInput.trim())
                        }
                      }}
                      className="btn-ink btn-ink-primary"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    >
                      Query
                    </button>
                  </div>
                </div>
              </div>

              {/* Patient Profile & Access Control Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.5rem' }}>
                {/* Profile Card */}
                <div className="pharmacy-glass" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: 'rgba(56, 189, 248, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--obs-accent)'
                    }}>
                      <User size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{patientProfile?.name || selectedPatientId}</h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>UID: {selectedPatientId}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-card)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Patient Age</span>
                      <strong>{patientProfile?.age ? `${patientProfile.age} yrs` : 'Not recorded'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-card)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Pharmacy record</span>
                      <span className={`status-pill ${patientProfile ? 'pill-ok' : 'pill-warn'}`}>{patientProfile ? 'On file' : 'None yet'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Pharmacy bills</span>
                      <strong>{patientBills.length} records</strong>
                    </div>
                  </div>
                </div>

                {/* Consent & Access Control Manager */}
                <div className="pharmacy-glass" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FolderLock size={18} color="#f59e0b" />
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Consent &amp; Access Control List</h3>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Pharmacy store</span>
                  </div>

                  <form onSubmit={handleGrantAccess} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <input
                      type="text"
                      placeholder="Doctor or Staff UID (e.g. dr_smith)"
                      value={newRequesterId}
                      onChange={e => setNewRequesterId(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '0.45rem 0.75rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-card)',
                        background: 'var(--bg-page)',
                        color: 'var(--text-primary)',
                        fontSize: '0.78rem'
                      }}
                      required
                    />
                    <button
                      type="submit"
                      disabled={accessActionLoading}
                      className="btn-ink btn-ink-primary"
                      style={{ fontSize: '0.75rem', padding: '0.45rem 0.85rem' }}
                    >
                      <Plus size={13} />
                      <span>Grant Access</span>
                    </button>
                  </form>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {patientAccessList.map((reqId, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.5rem',
                          background: 'var(--bg-page)',
                          border: '1px solid var(--border-card)',
                          fontSize: '0.75rem'
                        }}
                      >
                        <UserCheck size={13} color="#10b981" />
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{reqId}</span>
                        <button
                          type="button"
                          onClick={() => handleRevokeAccess(reqId)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                          title="Revoke Access"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Patient's pharmacy bills */}
              <div className="pharmacy-glass" style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                  Pharmacy bills for {patientProfile?.name || selectedPatientId || 'the selected patient'}
                </h3>

                {patientBills.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    {selectedPatientId ? `No pharmacy bills for ${selectedPatientId}.` : 'Enter a patient ID to see pharmacy bills.'}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="pharmacy-table">
                      <thead>
                        <tr>
                          <th>Bill ID</th>
                          <th>Date Issued</th>
                          <th>Prescription / Pack</th>
                          <th>Medicines Dispensed</th>
                          <th>Total Amount</th>
                          <th>Dispensed By</th>
                          <th>Status</th>
                          <th>Receipt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patientBills.map((b, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--obs-accent)', fontWeight: 600 }}>{b.billId}</td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(b.issuedAt).toLocaleDateString()}</td>
                            <td style={{ fontWeight: 600 }}>{b.templateName || 'Prescription Fulfillment'}</td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.75rem' }}>
                                {(b.medicineList || []).map((m, mIdx) => (
                                  <span key={mIdx}>• {m.name} <strong>(x{m.quantity})</strong></span>
                                ))}
                              </div>
                            </td>
                            <td style={{ color: '#10b981', fontWeight: 700 }}>${Number(b.amount || 0).toFixed(2)}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{b.issuedBy}</td>
                            <td>
                              <span className="status-pill pill-ok">
                                {b.status}
                              </span>
                            </td>
                            <td>
                              {b.ipfsHash ? (
                                <a
                                  href={`http://localhost:8090/ipfs/${b.ipfsHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-ink btn-ink-ghost"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', gap: '0.3rem' }}
                                >
                                  <ExternalLink size={12} />
                                  <span>IPFS</span>
                                </a>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : renderRbacGate(PHARMACY_ROLES[0], 'Patient Medical Records')
        )}

        {/* ── Tab 5: Operations, Telemetry & Workforce (Manager) ── */}
        {activeTab === 'operations' && (
          selectedRole.allowedTabs?.includes('operations') ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Pharmacy Operations &amp; Staff</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Service status, the pharmacy staff list and the audit of all pharmacy bills.
                </p>
              </div>

              {/* Service status (real values from the pharmacy backend) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="pharmacy-glass" style={{ padding: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pharmacy backend</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.25rem', color: networkStatus.service === 'UP' ? '#10b981' : '#f59e0b' }}>
                    {networkStatus.service || 'UNKNOWN'}
                  </div>
                </div>
                <div className="pharmacy-glass" style={{ padding: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>IPFS node</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.25rem', color: networkStatus.ipfs === 'UP' ? '#10b981' : '#f59e0b' }}>
                    {networkStatus.ipfs || 'UNKNOWN'}
                  </div>
                </div>
                <div className="pharmacy-glass" style={{ padding: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Where pharmacy records are kept</span>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '0.4rem' }}>
                    Pharmacy store (not on the ledger)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Dispensing a hospital prescription is the only pharmacy action written to the ledger.
                  </div>
                </div>
              </div>

              {/* Workforce Management (Onboarding + Live Roster) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
                {/* Onboard Form */}
                <div className="pharmacy-glass" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Users size={18} color="var(--obs-accent)" />
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Onboard Pharmacy Staff</h3>
                  </div>
                  <form onSubmit={handleRegisterEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Staff Identity ID</label>
                      <input
                        type="text"
                        placeholder="e.g. emp_005"
                        value={newEmp.userId}
                        onChange={e => setNewEmp({ ...newEmp, userId: e.target.value })}
                        style={{ width: '100%', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Full Legal Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Dr. Sneha Patel"
                        value={newEmp.name}
                        onChange={e => setNewEmp({ ...newEmp, name: e.target.value })}
                        style={{ width: '100%', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Operational Role</label>
                      <select
                        value={newEmp.role}
                        onChange={e => setNewEmp({ ...newEmp, role: e.target.value })}
                        style={{ width: '100%', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                      >
                        <option value="billing">Pharmacist (Dispensing & Billing)</option>
                        <option value="inventory">Inventory Specialist</option>
                        <option value="manager">Operations Administrator</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Department</label>
                      <input
                        type="text"
                        placeholder="e.g. Clinical Dispense"
                        value={newEmp.dept}
                        onChange={e => setNewEmp({ ...newEmp, dept: e.target.value })}
                        style={{ width: '100%', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={onboardLoading}
                      className="btn-ink btn-ink-primary"
                      style={{ marginTop: '0.5rem', padding: '0.65rem', fontSize: '0.85rem' }}
                    >
                      {onboardLoading ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={14} />
                          <span>Add to Staff List</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Staff Registry Table */}
                <div className="pharmacy-glass" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Credentialed Pharmacy Staff Registry</h3>
                    <button onClick={fetchOpsData} className="btn-ink btn-ink-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>
                      <RefreshCw size={12} className={opsLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                  <table className="pharmacy-table">
                    <thead>
                      <tr>
                        <th>Identity ID</th>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Department</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp, i) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--obs-accent)', fontWeight: 600 }}>{emp.userId || emp.empId}</td>
                          <td style={{ fontWeight: 600 }}>{emp.name}</td>
                          <td>
                            <span className="status-pill pill-info">{emp.role}</span>
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.dept || emp.metadata?.dept || '-'}</td>
                          <td>
                            <span className="status-pill pill-ok">Listed</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Global Audit Trail Table */}
              <div className="pharmacy-glass" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Pharmacy Bill Audit</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Every pharmacy bill with the staff member who issued it and its IPFS document.
                    </p>
                  </div>
                  <button onClick={fetchOpsData} className="btn-ink btn-ink-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>
                    <RefreshCw size={12} className={opsLoading ? 'animate-spin' : ''} />
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="pharmacy-table">
                    <thead>
                      <tr>
                        <th>Date &amp; Time</th>
                        <th>Bill ID</th>
                        <th>Patient UID</th>
                        <th>Prescription Pack</th>
                        <th>Amount ($)</th>
                        <th>Signer / Staff</th>
                        <th>IPFS Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditBills.map((b, i) => (
                        <tr key={i}>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(b.issuedAt).toLocaleString()}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--obs-accent)', fontWeight: 600 }}>{b.billId}</td>
                          <td style={{ fontWeight: 600 }}>{b.patientId}</td>
                          <td>{b.templateName || 'Prescription Fulfillment'}</td>
                          <td style={{ color: '#10b981', fontWeight: 700 }}>${Number(b.amount || 0).toFixed(2)}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{b.issuedBy}</td>
                          <td>
                            {b.ipfsHash ? (
                              <a
                                href={`http://localhost:8090/ipfs/${b.ipfsHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-ink btn-ink-ghost"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', gap: '0.3rem' }}
                              >
                                <ExternalLink size={11} />
                                <span>{b.ipfsHash.slice(0, 8)}...</span>
                              </a>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : renderRbacGate(PHARMACY_ROLES[3], 'Operations & Staff')
        )}
      </main>

      {/* ── Role Selection Modal (Hospital Card Style with Password Form) ── */}
      {roleModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 1040, padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Select Pharmacy Role Workspace</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Each credentialed role provides fine-grained access to clinical dispensing, inventory, billing, or audit.
                </p>
              </div>
              {session && (
                <button onClick={() => setRoleModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Active Session Notification Bar */}
            {session && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1.25rem',
                borderRadius: '0.85rem',
                background: 'rgba(56,189,248,0.1)',
                border: '1px solid rgba(56,189,248,0.25)',
                marginBottom: '1.5rem',
                fontSize: '0.8rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--obs-accent)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800
                  }}>
                    {session.username?.[0]?.toUpperCase() || 'P'}
                  </span>
                  <div>
                    <strong>Active Session:</strong> <span style={{ color: 'var(--obs-accent)', fontWeight: 700 }}>{session.username}</span> ({session.title})
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      You can return to your workspace directly or select any role below to verify new credentials.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRoleModalOpen(false)}
                  className="btn-ink btn-ink-primary"
                  style={{ fontSize: '0.75rem', padding: '0.45rem 1rem' }}
                >
                  Enter {session.title} Workspace →
                </button>
              </div>
            )}

            {/* Role Cards Grid */}
            <div className="role-grid" style={{ marginBottom: '1.5rem' }}>
              {PHARMACY_ROLES.map(r => {
                const isSelected = pendingRole.id === r.id
                const Icon = r.icon
                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectPendingRole(r)}
                    className={`role-card ${isSelected ? 'selected' : ''}`}
                    style={{
                      background: isSelected ? r.gradient : 'var(--bg-card)',
                      borderColor: isSelected ? r.borderSelected : 'var(--border-card)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <div style={{
                          width: 34,
                          height: 34,
                          borderRadius: '0.65rem',
                          background: isSelected ? r.borderSelected : 'rgba(255,255,255,0.06)',
                          color: isSelected ? 'white' : 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Icon size={18} />
                        </div>
                        <span className={`status-pill ${r.badgeTone}`} style={{ fontSize: '0.62rem' }}>
                          {r.badge}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                        {r.title}
                      </h4>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '0.75rem' }}>
                        {r.desc}
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-card)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Account:</span>
                        <code style={{ color: 'var(--obs-accent)', fontWeight: 600 }}>{r.user}</code>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.72rem' }}>
                        {isSelected ? (
                          <span style={{ color: r.borderSelected, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle2 size={13} /> Active Target
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Select Role →</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Credential Verification Form */}
            <form onSubmit={handleRoleAuthenticate} style={{
              background: 'var(--bg-page)',
              border: '1px solid var(--border-card)',
              borderRadius: '1rem',
              padding: '1.35rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <KeyRound size={17} color="var(--obs-accent)" />
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 800 }}>
                    Verify Role Credentials for {pendingRole.title}
                  </h3>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Hospital staff sign-in
                </span>
              </div>

              {authError && (
                <div style={{
                  padding: '0.65rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  fontSize: '0.78rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <AlertTriangle size={15} />
                  <span>{authError}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Username
                  </label>
                  <input
                    type="text"
                    value={authUsername}
                    onChange={e => setAuthUsername(e.target.value)}
                    placeholder="e.g. pharmacist"
                    required
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-card)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Demo user: <code style={{ color: 'var(--obs-accent)' }}>{pendingRole.user}</code>
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Password / Passphrase
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showAuthPass ? 'text' : 'password'}
                      value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                      style={{
                        width: '100%',
                        padding: '0.65rem 2.2rem 0.65rem 0.85rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-card)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthPass(!showAuthPass)}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      {showAuthPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', alignItems: 'center' }}>
                {session && (
                  <button
                    type="button"
                    onClick={() => setRoleModalOpen(false)}
                    className="btn-ink btn-ink-ghost"
                    style={{ fontSize: '0.8rem', padding: '0.55rem 1rem' }}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="btn-ink btn-ink-primary"
                  style={{ fontSize: '0.82rem', padding: '0.55rem 1.4rem', gap: '0.5rem' }}
                >
                  {authLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={15} />
                      <span>Authenticate &amp; Switch to {pendingRole.title}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Stock Batch Modal (Inventory Tab) ── */}
      {addBatchModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Register Pharmaceutical Batch</h3>
              <button onClick={() => setAddBatchModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Item SKU / ID</label>
                <input
                  type="text"
                  placeholder="Item ID"
                  value={newBatch.itemId}
                  onChange={e => setNewBatch({ ...newBatch, itemId: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Medicine Name &amp; Strength</label>
                <input
                  type="text"
                  placeholder="e.g. Azithromycin 500mg"
                  value={newBatch.name}
                  onChange={e => setNewBatch({ ...newBatch, name: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={newBatch.quantity}
                    onChange={e => setNewBatch({ ...newBatch, quantity: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Unit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newBatch.price}
                    onChange={e => setNewBatch({ ...newBatch, price: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                    required
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Package Unit</label>
                <select
                  value={newBatch.unit}
                  onChange={e => setNewBatch({ ...newBatch, unit: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                >
                  <option value="tablets">Tablets</option>
                  <option value="vials">Vials</option>
                  <option value="bottles">Bottles</option>
                  <option value="patches">Patches</option>
                  <option value="inhalers">Inhalers</option>
                </select>
              </div>
              <button type="submit" className="btn-ink btn-ink-primary" style={{ marginTop: '0.5rem', padding: '0.65rem' }}>
                <ShieldCheck size={14} /> Save Batch
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Dispense Verification Modal (Prescriptions Tab) ── */}
      {dispenseModalVisit && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Pill size={18} color="var(--obs-accent)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Fulfill Doctor Prescription</h3>
              </div>
              <button onClick={() => setDispenseModalVisit(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '0.85rem', borderRadius: '0.75rem', background: 'var(--bg-page)', marginBottom: '1rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Encounter ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{dispenseModalVisit.visitId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Patient UID:</span>
                <strong>{dispenseModalVisit.patientId}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Ordering Physician:</span>
                <span>{dispenseModalVisit.assignedDoctor || '-'}</span>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>Clinical Prescription Ordered</label>
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-card)', fontSize: '0.82rem', color: 'var(--obs-accent)', fontWeight: 600 }}>
                {prescriptionText(dispenseModalVisit.clinical?.prescriptions?.[dispenseModalVisit.clinical.prescriptions.length - 1])}
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>Pharmacist Verification Notes</label>
              <textarea
                rows={3}
                value={dispenseNotes}
                onChange={e => setDispenseNotes(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid var(--border-card)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setDispenseModalVisit(null)} className="btn-ink btn-ink-ghost" style={{ fontSize: '0.8rem' }}>
                Cancel
              </button>
              <button
                onClick={handleConfirmDispense}
                disabled={dispenseSubmitting}
                className="btn-ink btn-ink-primary"
                style={{ fontSize: '0.8rem', padding: '0.55rem 1.25rem' }}
              >
                {dispenseSubmitting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Signing Transaction...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Sign &amp; Commit Dispense Stamp</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
