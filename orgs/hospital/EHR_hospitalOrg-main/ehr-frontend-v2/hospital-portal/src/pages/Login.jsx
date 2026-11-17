import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Activity,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  User,
  ArrowRight,
  Stethoscope,
  Users,
  Pill,
  FolderOpen,
  CheckCircle2,
  Server
} from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'
import DataSourceTag from '../ui-kit/components/DataSourceTag'

const CLINICAL_ROLES = [
  {
    value: 'doctor',
    label: 'Clinical Doctor',
    username: 'doctor',
    hint: 'docpw',
    peer: 'peer1-api (Port 4002)',
    badge: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    icon: Stethoscope,
    desc: 'Patient encounters, clinical diagnosis, prescriptions & lab orders.',
    defaultPath: '/my-visits',
  },
  {
    value: 'nurse',
    label: 'Triage Nurse',
    username: 'nurse',
    hint: 'nursepw',
    peer: 'peer2-api (Port 4003)',
    badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
    icon: Activity,
    desc: 'Patient intake, triage queues, unit-aware vitals recording.',
    defaultPath: '/my-visits',
  },
  {
    value: 'receptionist',
    label: 'Reception & Registry',
    username: 'receptionist',
    hint: 'recpw',
    peer: 'peer0-api (Port 4001)',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    icon: Users,
    desc: 'Patient check-in, ABHA demographic registry & opening clinical visits.',
    defaultPath: '/patients',
  },
  {
    value: 'pharmacist',
    label: 'Hospital Pharmacist',
    username: 'pharmacist',
    hint: 'pharmpw',
    peer: 'peer2-api (Port 4003)',
    badge: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30',
    icon: Pill,
    desc: 'Medication fulfillment, dispensing queue & inventory ledger sync.',
    defaultPath: '/dispense',
  },
  {
    value: 'medrecordofficer',
    label: 'Medical Records Officer',
    username: 'medrecordofficer',
    hint: 'medpw',
    peer: 'peer2-api (Port 4003)',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    icon: FolderOpen,
    desc: 'Audit trail inspection, discharge checklists & record finalization.',
    defaultPath: '/finalize',
  },
  {
    value: 'admin',
    label: 'Hospital Governance',
    username: 'hospitaladmin',
    hint: 'hadminpw',
    peer: 'peer0-api (Port 4001)',
    badge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    icon: ShieldCheck,
    desc: 'Hospital administrator, clinical staff credentialing & patient discharge.',
    defaultPath: '/patients',
  },
]

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState(CLINICAL_ROLES[0]) // Default: Doctor
  const [username, setUsername]         = useState(CLINICAL_ROLES[0].username)
  const [password, setPassword]         = useState(CLINICAL_ROLES[0].hint)
  const [showPass, setShowPass]         = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const { login }                       = useAuth()
  const navigate                        = useNavigate()

  const handleSelectRole = (r) => {
    setSelectedRole(r)
    setUsername(r.username)
    setPassword(r.hint)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const userData = await login(username, password)
      const routes = {
        doctor:           '/my-visits',
        nurse:            '/my-visits',
        receptionist:     '/patients',
        admin:            '/patients',
        pharmacist:       '/dispense',
        medrecordofficer: '/finalize',
      }
      navigate(routes[userData.user?.role || selectedRole.value] || selectedRole.defaultPath)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Credential verification failed on Fabric peer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen soft-glass-backdrop relative flex flex-col justify-between p-4 sm:p-6 md:p-10 text-slate-800 dark:text-slate-100">
      {/* Background medical ambient overlay */}
      <div
        className="fixed inset-0 bg-cover bg-center opacity-15 dark:opacity-10 pointer-events-none filter blur-xs"
        style={{ backgroundImage: 'url("/assets/doctor-desk.jpg")' }}
      />

      {/* Top Bar with Gateway Status */}
      <header className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-md">
            <Activity size={20} className="text-teal-400 dark:text-teal-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">CareGrid EHR</span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                Hospital Gateway
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Decentralized Multi-Role Clinical Entry</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DataSourceTag source="live" />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Role Gateway Bento Box */}
      <main className="relative z-10 max-w-6xl w-full mx-auto my-6 flex-1 flex flex-col justify-center">
        <div className="soft-glass-shell p-6 md:p-8">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Hospital Organization Access Gateway
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5">
              Select your clinical role to route directly into your workspace and verify cryptographic credentials with the respective Hyperledger Fabric peer.
            </p>
          </div>

          {/* 6-Card Role Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-8">
            {CLINICAL_ROLES.map((r) => {
              const isSelected = selectedRole.value === r.value
              const Icon = r.icon
              return (
                <div
                  key={r.value}
                  onClick={() => handleSelectRole(r)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900 border-teal-500 shadow-md ring-2 ring-teal-500/20'
                      : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                        <Icon size={18} />
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${r.badge}`}>
                        {r.value}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {r.label}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {r.desc}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Server size={10} />
                      {r.peer.split(' ')[0]}
                    </span>
                    {isSelected && (
                      <span className="text-teal-600 dark:text-teal-400 font-bold flex items-center gap-1 font-sans">
                        <CheckCircle2 size={12} />
                        Active Selection
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Credential Verification Form */}
          <div className="max-w-xl mx-auto p-5 sm:p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Verify Credentials
                </h2>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  Sign in as {selectedRole.label}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-mono">Fabric Gateway Target:</span>
                <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400">
                  {selectedRole.peer}
                </span>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-ink-pill justify-center cursor-pointer py-3 mt-1 shadow-md"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Verify Credentials &amp; Enter {selectedRole.label} Workspace</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>MSP Identity: HospitalMSP</span>
              <span className="font-mono">Demo: {selectedRole.username} / {selectedRole.hint}</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 max-w-6xl w-full mx-auto text-center text-xs text-slate-400 py-2">
        CareGrid Electronic Health Record System · Hyperledger Fabric Multi-Peer Architecture
      </footer>
    </div>
  )
}
