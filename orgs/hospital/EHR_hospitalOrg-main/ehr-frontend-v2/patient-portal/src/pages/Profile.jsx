import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Card, Spinner, SectionTitle, Modal, Button, Input, Alert } from '../components/ui'
import { formatDate, formatDateTime } from '../utils/api'
import { User, Lock, LogOut, ChevronRight, Camera, ShieldCheck } from 'lucide-react'
import Avatar from '../design-system/components/Avatar'
import PhotoUploadModal from '../design-system/components/PhotoUploadModal'
import HashChip from '../ui-kit/components/HashChip'

export default function ProfilePage() {
  const { api, patient, logout } = useAuth()
  const [profile, setProfile]     = useState(null)
  const [history, setHistory]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [passModal, setPassModal] = useState(false)
  const [photoModal, setPhotoModal] = useState(false)
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass]         = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState('')

  const loadData = () => {
    Promise.allSettled([
      api().get('/profile'),
      api().get('/profile/history'),
    ]).then(([pRes, hRes]) => {
      if (pRes.status === 'fulfilled') setProfile(pRes.value.data.data)
      if (hRes.status === 'fulfilled') setHistory(hRes.value.data.data || [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const changePassword = async () => {
    if (newPass.length < 6) { setError('Password must be at least 6 characters'); return }
    setSaving(true); setError('')
    try {
      await api().put('/auth/password', { currentPassword: currentPass, newPassword: newPass })
      setSuccess('Password changed successfully')
      setPassModal(false); setCurrentPass(''); setNewPass('')
    } catch (err) { setError(err.response?.data?.error || 'Failed to change password') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionTitle>My Patient Profile</SectionTitle>
        <span className="font-mono text-xs text-slate-400">ABHA / ID: {patient?.patientId}</span>
      </div>

      {success && <Alert type="success">{success}</Alert>}

      {/* Avatar + Identity Card (Reference 3 Style) */}
      <div className="bento-card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar id={patient?.patientId} name={profile?.name || 'Patient'} size={64} status="online" />
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {profile?.name || 'Patient'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{patient?.patientId}</span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-xs text-slate-400">Enrolled {formatDate(profile?.createdAt)}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPhotoModal(true)}
          className="btn-vitalis-ghost py-2 px-4 text-xs cursor-pointer self-start sm:self-auto"
        >
          <Camera size={14} />
          <span>Upload Local Photo</span>
        </button>
      </div>

      {/* Account Info */}
      <div className="bento-card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Demographics &amp; Account</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 block">Patient ID</span>
            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">{patient?.patientId}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 block">Email Address</span>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">{patient?.email || '—'}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 block">Contact Phone</span>
            <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">{patient?.phone || '—'}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bento-card overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
        <button
          type="button"
          onClick={() => setPassModal(true)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800 text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Lock size={16} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Change Portal Password</span>
          </div>
          <ChevronRight size={14} className="text-slate-400" />
        </button>

        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <LogOut size={16} className="text-rose-500" />
            <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">Sign Out of Patient Session</span>
          </div>
          <ChevronRight size={14} className="text-rose-400" />
        </button>
      </div>

      {/* Blockchain Record History */}
      {history.length > 0 && (
        <div className="bento-card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              On-Chain Record Ledger ({history.length} entries)
            </p>
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
              <ShieldCheck size={12} />
              Fabric Channel Verified
            </span>
          </div>
          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {history.slice(0, 10).map((h, i) => (
              <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div>
                  <HashChip hash={h.txId} label="TX" />
                  <p className="text-[10px] text-slate-400 mt-1">{formatDateTime(h.timestamp)}</p>
                </div>
                <span className="font-mono text-[10px] text-slate-500">Committed</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Password Modal */}
      <Modal open={passModal} onClose={() => setPassModal(false)} title="Change Password" size="sm">
        <div className="space-y-4">
          <Input label="Current Password" type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} placeholder="Current password" />
          <Input label="New Password" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Min. 6 characters" />
          {error && <Alert type="error">{error}</Alert>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={() => setPassModal(false)}>Cancel</Button>
            <Button variant="teal" size="sm" loading={saving} onClick={changePassword}>Change Password</Button>
          </div>
        </div>
      </Modal>

      {/* Photo Upload Modal */}
      <PhotoUploadModal
        isOpen={photoModal}
        targetId={patient?.patientId}
        targetName={profile?.name || 'Patient'}
        onClose={() => setPhotoModal(false)}
        onPhotoSaved={() => loadData()}
      />
    </div>
  )
}
