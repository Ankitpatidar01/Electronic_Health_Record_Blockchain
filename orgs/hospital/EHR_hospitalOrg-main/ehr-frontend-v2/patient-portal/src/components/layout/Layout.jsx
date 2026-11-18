import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Heart,
  Calendar,
  FileText,
  ShieldCheck,
  Fingerprint,
  FolderLock,
  User,
  LogOut,
} from 'lucide-react'
import ThemeToggle from '../ThemeToggle'
import { BASE } from '../../utils/api'
import { useServiceHealth, HEALTH_PILL } from '../../hooks/useServiceHealth'

const NAV_ITEMS = [
  { to: '/overview', icon: Heart, label: 'Health Home', short: 'Home' },
  { to: '/visits', icon: Calendar, label: 'My Visits', short: 'Visits' },
  { to: '/ehr', icon: FileText, label: 'Record Vault', short: 'Records' },
  { to: '/digilocker', icon: FolderLock, label: 'DigiLocker Vault', short: 'Locker' },
  { to: '/access', icon: ShieldCheck, label: 'Consent Centre', short: 'Consent' },
  { to: '/signatures', icon: Fingerprint, label: 'On-Chain Proof', short: 'Proof' },
  { to: '/profile', icon: User, label: 'My Profile', short: 'Profile' },
]

export default function Layout({ children }) {
  const { patient, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const health = useServiceHealth(`${BASE}/health`)

  if (!patient) return null

  const isActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/')

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="dashboard-shell min-h-screen">
      <header className="dashboard-topbar sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="CareGrid NITW" className="h-8 w-8 object-contain" />
            <div>
              <div className="font-bold tracking-tight text-slate-900 dark:text-white">
                CareGrid <span className="text-blue-600 dark:text-sky-400">Patient</span>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">NIT Warangal Health Center · Personal Health Vault</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`status-pill ${HEALTH_PILL[health].tone} hidden md:inline-flex`} role="status">
              <span className="status-pill-dot" />
              {HEALTH_PILL[health].label}
            </span>
            <div className="hidden text-right sm:block">
              <div className="max-w-36 truncate font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{patient.patientId}</div>
              <div className="max-w-36 truncate text-[10px] text-slate-500 dark:text-slate-400">{patient.email || 'Patient account'}</div>
            </div>
            <ThemeToggle />
            <button type="button" onClick={handleLogout} className="dashboard-logout" aria-label="Log out">
              <LogOut size={16} />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Clean Sub-navbar below topbar — no scrollbars, clean pill navigation */}
      <nav className="hidden lg:block sticky top-[57px] z-20 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-2.5 md:px-8" aria-label="Patient navigation sub-navbar">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 overflow-x-auto no-scrollbar">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              aria-current={isActive(to) ? 'page' : undefined}
              className={`dashboard-nav-link whitespace-nowrap !px-3.5 !py-1.5 !text-xs !font-semibold rounded-full transition-all ${
                isActive(to)
                  ? '!bg-blue-600 !text-white shadow-xs shadow-blue-500/20 dark:!bg-blue-600 dark:!text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon size={15} />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-[1600px] p-4 pb-28 md:p-8 lg:pb-8">
        {children}
      </main>

      <nav className="obs-rail lg:hidden fixed bottom-3 left-3 right-3 z-40 p-1.5" aria-label="Patient navigation">
        <div className="flex items-center justify-between gap-1 overflow-x-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, short }) => (
            <Link
              key={to}
              to={to}
              aria-current={isActive(to) ? 'page' : undefined}
              className={`dashboard-nav-link !w-auto flex-1 !flex-col !gap-0.5 !px-2 !py-1.5 !text-[10px] !justify-center ${isActive(to) ? 'is-active' : ''}`}
            >
              <Icon size={17} />
              <span>{short}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
