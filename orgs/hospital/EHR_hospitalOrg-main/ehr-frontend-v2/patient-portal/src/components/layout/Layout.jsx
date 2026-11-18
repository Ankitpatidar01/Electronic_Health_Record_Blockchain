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
      <header className="dashboard-topbar sticky top-0 z-30 border-b px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4">
          <div className="flex min-w-[200px] items-center gap-3">
            <img src="/logo.svg" alt="" className="h-8 w-8 object-contain" />
            <div>
              <div className="font-bold tracking-tight text-slate-900 dark:text-white">
                Vitalis <span className="text-blue-600 dark:text-sky-400">Patient</span>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">Personal Health Vault</div>
            </div>
          </div>

          <nav className="hidden lg:flex flex-1 items-center gap-1 overflow-x-auto" aria-label="Patient navigation">
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                aria-current={isActive(to) ? 'page' : undefined}
                className={`dashboard-nav-link ${isActive(to) ? 'is-active' : ''}`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
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
