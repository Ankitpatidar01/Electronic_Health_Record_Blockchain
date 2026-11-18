import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Users, Calendar, FileText, LogOut, Activity,
  Stethoscope, Pill, FolderOpen, ChevronRight, Menu, X
} from 'lucide-react'
import { useState } from 'react'
import ThemeToggle from '../ThemeToggle'
import { getApiBase } from '../../utils/api'
import { useServiceHealth, HEALTH_PILL } from '../../hooks/useServiceHealth'
import Avatar from '../../design-system/components/Avatar'
import BRAND from '../../design-system/brand.config'

const ROLE_CONFIG = {
  receptionist: {
    label: 'Reception & Registry',
    nav: [
      { to: '/patients',   icon: Users,    label: 'Patients' },
      { to: '/visits',     icon: Calendar, label: 'Active Visits' },
      { to: '/register',   icon: Users,    label: 'Register Patient' },
      { to: '/open-visit', icon: Calendar, label: 'Open New Visit' },
    ],
  },
  admin: {
    label: 'Hospital Governance',
    nav: [
      { to: '/patients',   icon: Users,    label: 'Patients' },
      { to: '/staff',      icon: Users,    label: 'Doctors & Staff' },
      { to: '/visits',     icon: Calendar, label: 'Encounters' },
      { to: '/register',   icon: Users,    label: 'Register Patient' },
      { to: '/open-visit', icon: Calendar, label: 'Open Visit' },
      { to: '/discharge',  icon: LogOut,   label: 'Discharge' },
    ],
  },
  doctor: {
    label: 'Clinical Physician',
    nav: [
      { to: '/my-visits',    icon: Stethoscope, label: 'Doctor Queue' },
      { to: '/visit-detail', icon: FileText,    label: 'Clinical Chart' },
    ],
  },
  nurse: {
    label: 'Nursing & Triage',
    nav: [
      { to: '/my-visits', icon: Activity, label: 'Triage & Vitals' },
    ],
  },
  pharmacist: {
    label: 'Clinical Pharmacy',
    nav: [
      { to: '/dispense', icon: Pill, label: 'Dispense Queue' },
    ],
  },
  medrecordofficer: {
    label: 'Medical Records Audit',
    nav: [
      { to: '/finalize', icon: FolderOpen, label: 'Finalize & Archive' },
    ],
  },
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const health = useServiceHealth(user ? `${getApiBase(user.role)}/health` : null)

  if (!user) return null

  const cfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.receptionist
  const isActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/')

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full p-4 select-none">
      <div className="flex items-center gap-3 mb-6 px-1">
        <img src="/logo.svg" alt="" className="h-9 w-9 object-contain" />
        <div className="min-w-0">
          <div className="font-bold tracking-tight text-slate-900 dark:text-white">
            {BRAND.name} <span className="text-blue-600 dark:text-sky-400">Clinical</span>
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400 truncate">{cfg.label}</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin" aria-label="Workspace navigation">
        <p className="eyebrow px-3 !mb-2">Navigation</p>
        {cfg.nav.map(({ to, icon: Icon, label }) => {
          const active = isActive(to)
          return (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={`dashboard-nav-link ${active ? 'is-active' : ''}`}
            >
              <Icon size={16} />
              <span>{label}</span>
              {active && <ChevronRight size={14} className="ml-auto opacity-70" />}
            </Link>
          )
        })}
      </nav>

      <div className="pt-4 mt-4 obs-divider space-y-3">
        <div className="flex items-center gap-3 px-1">
          <Avatar id={user.username} name={user.username} size={36} status="online" ring={false} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{user.username}</p>
            <p className="text-[10px] capitalize text-slate-500 dark:text-slate-400 truncate">{user.role}</p>
          </div>
        </div>
        <button type="button" onClick={handleLogout} className="dashboard-logout w-full justify-center">
          <LogOut size={14} />
          <span>Switch role / sign out</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="dashboard-shell flex h-screen overflow-hidden">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col p-4 pr-0">
        <div className="obs-rail flex-1 min-h-0"><SidebarContent /></div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 p-3">
            <div className="obs-rail h-full relative">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="absolute right-3 top-3 p-1.5 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              >
                <X size={18} />
              </button>
              <SidebarContent />
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="dashboard-topbar m-4 mb-0 rounded-[1.25rem] border px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <p className="eyebrow !mb-0.5">{cfg.label}</p>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white truncate">Hospital Operations</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className={`status-pill ${HEALTH_PILL[health].tone} hidden sm:inline-flex`} role="status">
              <span className="status-pill-dot" />
              {HEALTH_PILL[health].label}
            </span>
            <ThemeToggle />
            <button type="button" onClick={handleLogout} className="dashboard-logout" title="Return to the role gateway">
              <Users size={14} />
              <span className="hidden sm:inline">Switch role</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
