import { useState, useEffect } from 'react'
import { Plus, User, Stethoscope, ShieldCheck, Activity, Search, RefreshCw, Camera } from 'lucide-react'
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
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [modal, setModal] = useState(false)
  const [uploadTarget, setUploadTarget] = useState(null)

  // Form
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('doctor')

  useEffect(() => {
    fetchStaff()
  }, [])

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
      fetchStaff()
    } catch (err) {
      alert(err.response?.data?.error || 'Creation failed')
    }
  }

  const filteredStaff = staff.filter(s => {
    const matchesSearch = s.username.toLowerCase().includes(search.toLowerCase()) ||
                          s.role.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || s.role.toLowerCase() === roleFilter
    return matchesSearch && matchesRole
  })

  const doctorCount = staff.filter(s => s.role === 'doctor').length

  return (
    <div className="space-y-6">
      {/* Reference 3: Counter Header ("Available Doctors 22" style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="vitalis-counter-header mb-0">
            <span>Available Clinical Staff</span>
            <span className="count">{filteredStaff.length}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Doctors ({doctorCount}) · Nurses · Pharmacists · Administrators registered under HospitalMSP
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

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['all', 'doctor', 'nurse', 'pharmacist', 'medrecordofficer', 'admin'].map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all ${
                roleFilter === r
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
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
          No personnel match your search criteria.
        </div>
      ) : (
        /* Reference 3: Card Grid with ProfileCards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map(s => {
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
                  onAction={() => setUploadTarget({ id: s.username, name: s.username })}
                  actionLabel="Upload Photo"
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
                onAction={() => setUploadTarget({ id: s.username, name: s.username })}
                actionLabel="Photo"
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
