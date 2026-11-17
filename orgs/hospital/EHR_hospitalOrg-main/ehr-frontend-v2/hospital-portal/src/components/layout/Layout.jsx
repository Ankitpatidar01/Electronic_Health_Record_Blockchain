import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Users, Calendar, FileText, LogOut, Activity,
  Stethoscope, Pill, FolderOpen, ChevronRight, Menu, X, ShieldCheck
} from 'lucide-react'
import { useState } from 'react'
import ThemeToggle from '../ThemeToggle'
import VerifiedBadge from '../../ui-kit/components/VerifiedBadge'
import DataSourceTag from '../../ui-kit/components/DataSourceTag'

const ROLE_CONFIG = {
  receptionist: {
    label: 'Reception & Registry',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    nav: [
      { to: '/patients',   icon: Users,    label: 'Patient Directory' },
      { to: '/visits',     icon: Calendar, label: 'All Visits' },
      { to: '/register',   icon: Users,    label: 'Register Patient' },
      { to: '/open-visit', icon: Calendar, label: 'Open New Visit' },
    ],
  },
  admin: {
    label: 'Hospital Governance',
    badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    nav: [
      { to: '/patients',   icon: Users,    label: 'Patient Directory' },
      { to: '/staff',      icon: Users,    label: 'Clinical Roster' },
      { to: '/visits',     icon: Calendar, label: 'Active Encounters' },
      { to: '/register',   icon: Users,    label: 'Register Patient' },
      { to: '/open-visit', icon: Calendar, label: 'Open New Visit' },
      { to: '/discharge',  icon: LogOut,   label: 'Patient Discharge' },
    ],
  },
  doctor: {
    label: 'Clinical Physician',
    badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    nav: [
      { to: '/my-visits',    icon: Stethoscope, label: 'Patient Queue' },
      { to: '/visit-detail', icon: FileText,    label: 'Encounter Chart' },
    ],
  },
  nurse: {
    label: 'Nursing & Triage',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    nav: [
      { to: '/my-visits', icon: Activity, label: 'Triage & Vitals' },
    ],
  },
  pharmacist: {
    label: 'Clinical Pharmacy',
    badgeClass: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    nav: [
      { to: '/dispense', icon: Pill, label: 'Dispense Queue' },
    ],
  },
  medrecordofficer: {
    label: 'Medical Records Audit',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
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

  if (!user) return null

  const cfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.receptionist
  const isActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/')

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-sm">
            <Activity size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">CareGrid</span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300">
                Staff
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{cfg.label}</p>
          </div>
        </div>
      </div>

      {/* User Role Card */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-800 text-teal-300 flex items-center justify-center font-bold text-xs">
            {user.username?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user.username}</p>
            <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border mt-0.5 ${cfg.badgeClass}`}>
              {user.role}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Clinical Operations
        </div>
        {cfg.nav.map(({ to, icon: Icon, label }) => {
          const active = isActive(to)
          return (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                active
                  ? 'bg-teal-600/20 text-teal-300 border border-teal-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon size={16} className={active ? 'text-teal-400' : 'text-slate-500'} />
                <span>{label}</span>
              </div>
              {active && <ChevronRight size={13} className="text-teal-400" />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Status & Sign Out */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <DataSourceTag source="live" />
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-950/20 border border-slate-800 hover:border-red-900/40 transition-all w-full cursor-pointer"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-800 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Global Bar */}
        <header className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">CareGrid EHR</span>
              <span className="hidden sm:inline-block text-slate-400 dark:text-slate-500">/</span>
              <span className="hidden sm:inline-block text-xs text-slate-500 dark:text-slate-400">{cfg.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-teal-50 hover:bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800 transition-colors shadow-xs cursor-pointer"
              title="Return to the Hospital Organization Main Gateway to choose another role"
            >
              <Users size={13} />
              <span>Hospital Gateway / Switch Role</span>
            </button>
            <VerifiedBadge verified={true} />
            <span className="hidden sm:inline-flex text-[11px] font-mono font-medium px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Org: HospitalMSP
            </span>
          </div>
        </header>

        {/* Scrollable Clinical Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/60 dark:bg-slate-950/80">
          {children}
        </main>
      </div>
    </div>
  )
}
