import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Heart,
  Calendar,
  FileText,
  ShieldCheck,
  Fingerprint,
  User,
  LogOut,
  ChevronRight,
  Activity
} from 'lucide-react'
import ThemeToggle from '../ThemeToggle'
import VerifiedBadge from '../../ui-kit/components/VerifiedBadge'
import DataSourceTag from '../../ui-kit/components/DataSourceTag'

const NAV_ITEMS = [
  { to: '/overview',   icon: Heart,       label: 'Health Home',   badge: null },
  { to: '/visits',     icon: Calendar,    label: 'My Visits',     badge: null },
  { to: '/ehr',        icon: FileText,    label: 'Record Vault',  badge: null },
  { to: '/access',     icon: ShieldCheck, label: 'Consent Centre', badge: null },
  { to: '/signatures', icon: Fingerprint, label: 'On-Chain Proof', badge: null },
  { to: '/profile',    icon: User,        label: 'My Profile',    badge: null },
]

export default function Layout({ children }) {
  const { patient, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (!patient) return null

  const isActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/')

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen soft-glass-backdrop relative overflow-x-hidden flex flex-col justify-between text-slate-800 dark:text-slate-100">
      {/* Background ambient texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20 dark:opacity-10 bg-center bg-cover"
        style={{ backgroundImage: 'url("/assets/mesh-gradient.svg")' }}
      />

      {/* Main Glass Container Shell */}
      <div className="relative z-10 w-full max-w-7xl mx-auto p-3 sm:p-5 md:p-8 flex-1 flex flex-col">
        {/* Top Header Bar */}
        <header className="soft-glass-shell px-5 py-3.5 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-md">
              <Activity size={20} className="text-teal-400 dark:text-teal-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">CareGrid</span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  Patient Panel
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Soft Glass Bento · Zero-Trust EHR</p>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <VerifiedBadge verified={true} />
              <DataSourceTag source="live" />
            </div>

            <ThemeToggle />

            {/* Patient identity chip */}
            <div className="hidden md:flex flex-col text-right pl-2 border-l border-slate-200 dark:border-slate-700">
              <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{patient.patientId}</span>
              <span className="text-[11px] text-slate-400 truncate max-w-[120px]">{patient.email || 'Verified Account'}</span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              title="Sign out of patient portal"
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-950/40 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Content Layout: Responsive Sidebar on Desktop + Bento Canvas */}
        <div className="flex-1 flex gap-6 items-start">
          {/* Desktop Left Sidebar (Bento Navigation) */}
          <aside className="hidden lg:flex flex-col w-64 shrink-0 soft-glass-shell p-4 space-y-1">
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Navigation
            </div>
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
              const active = isActive(to)
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                    active
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={active ? 'text-teal-400 dark:text-teal-600' : 'text-slate-400'} />
                    <span>{label}</span>
                  </div>
                  {active && <ChevronRight size={14} className="opacity-70" />}
                </Link>
              )
            })}

            {/* Blockchain Trust Card in Sidebar */}
            <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800">
              <div className="p-3.5 rounded-2xl bento-card-mint text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                  <ShieldCheck size={15} className="text-emerald-600" />
                  <span>Tamper-Evident</span>
                </div>
                <p className="text-[11px] opacity-80 leading-relaxed">
                  Every visit and prescription change is cryptographically anchored to Hyperledger Fabric.
                </p>
              </div>
            </div>
          </aside>

          {/* Main Bento Dynamic Content Area */}
          <main className="flex-1 min-w-0 pb-20 lg:pb-6">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-50 soft-glass-shell p-1.5 shadow-2xl">
        <div className="flex items-center justify-around">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const active = isActive(to)
            return (
              <Link
                key={to}
                to={to}
                className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Icon size={18} />
                <span className="text-[10px] mt-0.5 tracking-tight">{label.split(' ')[0]}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
