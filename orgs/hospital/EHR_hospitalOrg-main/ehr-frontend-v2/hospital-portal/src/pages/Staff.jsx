import { useState, useEffect } from 'react'
import {
  Plus,
  User,
  Stethoscope,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Search,
  RefreshCw,
  Camera,
  Trash2,
  AlertTriangle,
  X,
  CheckCircle2,
  UserX,
  UserCheck
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { Button, Card, Input } from '../components/ui'
import DoctorCard from '../design-system/components/DoctorCard'
import StaffCard from '../design-system/components/StaffCard'
import PhotoUploadModal from '../design-system/components/PhotoUploadModal'

const API_URL = '/api/hospital/peer0'

export default function Staff() {
  const { user, token } = useAuth()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error', message: '' }
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'revoked'

  // Modals
  const [modal, setModal] = useState(false)
  const [uploadTarget, setUploadTarget] = useState(null)
  const [revokeTarget, setRevokeTarget] = useState(null) // { username, role, currentStatus }
  const [deleteTarget, setDeleteTarget] = useState(null) // { username, role }
  const [actionLoading, setActionLoading] = useState(false)

  // Form
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('doctor')

  useEffect(() => {
    fetchStaff()
  }, [])

  const showFeedback = (type, message) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const res = await axios.get(`${API_URL}/auth/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setStaff(res.data.data || [])
    } catch (err) {
      setError('Failed to fetch staff directory from Fabric peer0')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`${API_URL}/auth/users`, { username, password, role }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setModal(false)
      setUsername('')
      setPassword('')
      showFeedback('success', `Staff member ${username} registered successfully`)
      fetchStaff()
    } catch (err) {
      alert(err.response?.data?.error || 'Creation failed')
    }
  }

  const handleToggleStatus = async () => {
    if (!revokeTarget) return
    const { username: targetUser, currentStatus } = revokeTarget
    const nextStatus = currentStatus === 'revoked' ? 'active' : 'revoked'

    try {
      setActionLoading(true)
      await axios.patch(`${API_URL}/auth/users/${targetUser}/status`, { status: nextStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setRevokeTarget(null)
      showFeedback('success', `Account ${targetUser} is now ${nextStatus}`)
      fetchStaff()
    } catch (err) {
      showFeedback('error', err.response?.data?.error || 'Failed to update account status')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteTarget) return
    const { username: targetUser } = deleteTarget

    try {
      setActionLoading(true)
      await axios.delete(`${API_URL}/auth/users/${targetUser}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setDeleteTarget(null)
      showFeedback('success', `Account ${targetUser} permanently removed`)
      fetchStaff()
    } catch (err) {
      showFeedback('error', err.response?.data?.error || 'Failed to delete user')
    } finally {
      setActionLoading(false)
    }
  }

  const filteredStaff = staff.filter(s => {
    const matchesSearch = s.username.toLowerCase().includes(search.toLowerCase()) ||
                          s.role.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || s.role.toLowerCase() === roleFilter
    const userStatus = s.status || 'active'
    const matchesStatus = statusFilter === 'all' || userStatus === statusFilter
    return matchesSearch && matchesRole && matchesStatus
  })

  const doctorCount = staff.filter(s => s.role === 'doctor').length
  const activeCount = staff.filter(s => (s.status || 'active') === 'active').length
  const revokedCount = staff.filter(s => s.status === 'revoked').length

  return (
    <div className="space-y-6">
      {/* Counter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="vitalis-counter-header mb-0">
            <span>Available Clinical Staff</span>
            <span className="count">{filteredStaff.length}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Total {staff.length} registered · {activeCount} active · {revokedCount} revoked · Doctors ({doctorCount}) under HospitalMSP
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchStaff}
            className="btn-vitalis-ghost py-2 px-3 text-xs"
            title="Refresh directory"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setModal(true)}
            className="btn-vitalis-pill py-2 px-4 text-xs"
          >
            <Plus size={15} />
            <span>Add Staff Account</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-2xl text-xs flex items-center justify-between gap-3 transition-all ${
          feedback.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, username or role..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            All ({staff.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('revoked')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'revoked'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            Revoked ({revokedCount})
          </button>
        </div>

        {/* Role Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['all', 'doctor', 'nurse', 'pharmacist', 'medrecordofficer', 'admin'].map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all ${
                roleFilter === r
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              {r === 'all' ? 'All Roles' : r === 'medrecordofficer' ? 'Records' : r}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-44 rounded-3xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-400">
          No personnel match your filter criteria.
        </div>
      ) : (
        /* Card Grid with ProfileCards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map(s => {
            const isProtected = s.username === 'hospitaladmin' || s.username === user?.username
            const accountStatus = s.status || 'active'

            if (s.role === 'doctor') {
              return (
                <DoctorCard
                  key={s.username}
                  id={s.username}
                  name={s.username}
                  specialty="General Medicine"
                  qualifications="MBBS, MD (HospitalMSP)"
                  rating="4.9"
                  availability="Mon - Fri: 09:00 am - 01:00 pm"
                  status="online"
                  accountStatus={accountStatus}
                  isProtected={isProtected}
                  onAction={() => setUploadTarget({ id: s.username, name: s.username })}
                  actionLabel="Photo"
                  onRevokeToggle={() => setRevokeTarget({ username: s.username, role: s.role, currentStatus: accountStatus })}
                  onDelete={() => setDeleteTarget({ username: s.username, role: s.role })}
                />
              )
            }
            return (
              <StaffCard
                key={s.username}
                id={s.username}
                name={s.username}
                role={s.role}
                department={s.role === 'nurse' ? 'Inpatient & Triage' : s.role === 'pharmacist' ? 'Pharmacy Dispense' : 'Administration'}
                status="online"
                accountStatus={accountStatus}
                isProtected={isProtected}
                onAction={() => setUploadTarget({ id: s.username, name: s.username })}
                actionLabel="Photo"
                onRevokeToggle={() => setRevokeTarget({ username: s.username, role: s.role, currentStatus: accountStatus })}
                onDelete={() => setDeleteTarget({ username: s.username, role: s.role })}
              />
            )
          })}
        </div>
      )}

      {/* Add Staff Modal */}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-sky-950/60 text-blue-600 dark:text-sky-400 flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Register Clinical Staff</h3>
                <p className="text-xs text-slate-500">Fabric MSP-Authenticated User</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                >
                  <option value="doctor">Doctor</option>
                  <option value="nurse">Nurse</option>
                  <option value="pharmacist">Pharmacist</option>
                  <option value="medrecordofficer">Medical Records Officer</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <Input label="Username" value={username} onChange={e => setUsername(e.target.value)} required />
              <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />

              <div className="flex gap-2 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setModal(false)} type="button">Cancel</Button>
                <Button className="flex-1" type="submit">Create User</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke / Reinstate Confirmation Modal */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                revokeTarget.currentStatus === 'revoked'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
              }`}>
                {revokeTarget.currentStatus === 'revoked' ? <UserCheck size={22} /> : <UserX size={22} />}
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {revokeTarget.currentStatus === 'revoked' ? 'Reinstate Access' : 'Revoke Staff Access'}
                </h3>
                <p className="text-xs text-slate-500">
                  {revokeTarget.username} ({revokeTarget.role})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              {revokeTarget.currentStatus === 'revoked'
                ? `Are you sure you want to reinstate access for ${revokeTarget.username}? They will immediately regain ability to log in and access clinical tools.`
                : `Are you sure you want to revoke access for ${revokeTarget.username}? This immediately locks their account, prevents authentication, and stops transaction endorsement. Historical records and audit logs are safely preserved.`}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={actionLoading}
                className={`flex-1 py-2.5 rounded-full text-xs font-semibold text-white shadow-xs transition-colors flex items-center justify-center gap-1.5 ${
                  revokeTarget.currentStatus === 'revoked'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionLoading ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  revokeTarget.currentStatus === 'revoked' ? 'Reinstate' : 'Revoke Access'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Delete Account</h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                  Permanent Action
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-900 dark:text-white font-mono">{deleteTarget.username}</strong> ({deleteTarget.role})?
            </p>

            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-[11px] text-rose-700 dark:text-rose-300 mb-4">
              <AlertTriangle size={14} className="inline mr-1 -mt-0.5" />
              This credentials record will be completely removed from the HospitalMSP directory. This action cannot be reversed.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-full text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {actionLoading ? <RefreshCw size={13} className="animate-spin" /> : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Local Photo Upload Modal */}
      <PhotoUploadModal
        isOpen={!!uploadTarget}
        targetId={uploadTarget?.id}
        targetName={uploadTarget?.name}
        onClose={() => setUploadTarget(null)}
        onPhotoSaved={() => fetchStaff()}
      />
    </div>
  )
}
