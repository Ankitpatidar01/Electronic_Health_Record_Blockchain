import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Activity, ShieldCheck, Eye, EyeOff, ChevronDown, Lock, User, ArrowRight } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'
import DataSourceTag from '../ui-kit/components/DataSourceTag'

const ROLES = [
  { value: 'receptionist',     label: 'Receptionist',       hint: 'recpw',    desc: 'Patient intake & visit booking' },
  { value: 'admin',            label: 'Hospital Admin',      hint: 'hadminpw', desc: 'System governance & staff roster' },
  { value: 'doctor',           label: 'Clinical Doctor',     hint: 'docpw',    desc: 'Encounters, diagnosis & prescriptions' },
  { value: 'nurse',            label: 'Triage Nurse',        hint: 'nursepw',  desc: 'Vitals recording & patient intake' },
  { value: 'pharmacist',       label: 'Hospital Pharmacist', hint: 'pharmpw',  desc: 'Medication dispensation & ledger audit' },
  { value: 'medrecordofficer', label: 'Medical Records',     hint: 'medpw',    desc: 'Chart finalization & archiving' },
]

const ROLE_USERNAMES = {
  receptionist:     'receptionist',
  admin:            'hospitaladmin',
  doctor:           'doctor',
  nurse:            'nurse',
  pharmacist:       'pharmacist',
  medrecordofficer: 'medrecordofficer',
}

export default function LoginPage() {
  const [role, setRole]           = useState('receptionist')
  const [username, setUsername]   = useState('receptionist')
  const [password, setPassword]   = useState('recpw')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const { login }                 = useAuth()
  const navigate                  = useNavigate()

  const handleRoleChange = (r) => {
    setRole(r)
    setUsername(ROLE_USERNAMES[r])
    setPassword(ROLES.find(x => x.value === r)?.hint || '')
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const userData = await login(username, password)
      const routes = {
        receptionist:     '/patients',
        admin:            '/patients',
        doctor:           '/my-visits',
        nurse:            '/my-visits',
        pharmacist:       '/dispense',
        medrecordofficer: '/finalize',
      }
      navigate(routes[userData.role] || '/patients')
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const selectedRole = ROLES.find(r => r.value === role)

  return (
    <div className="min-h-screen soft-glass-backdrop relative flex items-center justify-center p-4 text-slate-800 dark:text-slate-100">
      {/* Background medical image */}
      <div
        className="fixed inset-0 bg-cover bg-center opacity-15 dark:opacity-10 pointer-events-none filter blur-xs"
        style={{ backgroundImage: 'url("/assets/doctor-desk.jpg")' }}
      />

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-3xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl mb-3">
            <Activity size={26} className="text-teal-400 dark:text-teal-600" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            CareGrid EHR
          </h1>
          <p className="text-xs uppercase tracking-wider font-semibold text-teal-600 dark:text-teal-400 mt-1">
            Hospital Clinical Staff Portal
          </p>
        </div>

        {/* Glass Card */}
        <div className="soft-glass-shell p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select Clinical Role
                </label>
                <DataSourceTag source="live" />
              </div>
              <div className="relative">
                <select
                  value={role}
                  onChange={e => handleRoleChange(e.target.value)}
                  className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                      {r.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              {selectedRole?.desc && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-1">
                  Scope: {selectedRole.desc}
                </p>
              )}
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Staff ID / Username
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  placeholder="e.g. doctor"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-ink-pill justify-center cursor-pointer py-3 mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In as {selectedRole?.label}</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>Hyperledger Fabric MSP-Authenticated Session</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
