import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Users, Calendar, FileText, LogOut, Activity,
  Stethoscope, Pill, FolderOpen, ChevronRight, Menu, X, ShieldCheck,
  Search, Bell
} from 'lucide-react'
import { useState } from 'react'
import ThemeToggle from '../ThemeToggle'
import VerifiedBadge from '../../ui-kit/components/VerifiedBadge'
import DataSourceTag from '../../ui-kit/components/DataSourceTag'
import Avatar from '../../design-system/components/Avatar'
import BRAND from '../../design-system/brand.config'

const ROLE_CONFIG = {
  receptionist: {
    label: 'Reception & Registry',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    nav: [
      { to: '/patients',   icon: Users,    label: 'Patients' },
      { to: '/visits',     icon: Calendar, label: 'Active Visits' },
      { to: '/register',   icon: Users,    label: 'Register Patient' },
      { to: '/open-visit', icon: Calendar, label: 'Open New Visit' },
    ],
  },
  admin: {
    label: 'Hospital Governance',
    badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
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
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    nav: [
      { to: '/my-visits',    icon: Stethoscope, label: 'Doctor Queue' },
      { to: '/visit-detail', icon: FileText,    label: 'Clinical Chart' },
    ],
  },
  nurse: {
    label: 'Nursing & Triage',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    nav: [
      { to: '/my-visits', icon: Activity, label: 'Triage & Vitals' },
    ],
  },
  pharmacist: {
    label: 'Clinical Pharmacy',
    badgeClass: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    nav: [
      { to: '/dispense', icon: Pill, label: 'Dispense Queue' },
    ],
  },
  medrecordofficer: {
    label: 'Medical Records Audit',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
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
  const [globalSearch, setGlobalSearch] = useState('')

  if (!user) return null

  const cfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.receptionist
  const isActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/')

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full p-4 lg:p-6 text-white select-none">
      {/* Brand Header with Heart-ECG Logo (Reference 3) */}
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center p-2 shadow-sm">
          <img src="/logo.svg" alt="Vitalis" className="w-full h-full object-contain" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-lg tracking-tight text-white font-sans">
              {BRAND.name}
            </h1>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-white/15 text-teal-200">
              Clinical
            </span>
          </div>
          <p className="text-[11px] text-teal-100/70 truncate">{cfg.label}</p>
        </div>
      </div>

      {/* Pill Navigation Links (Reference 3: Pill tabs with active highlight) */}
      <nav className="flex-1 space-y-2 overflow-y-auto pr-1">
        <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-teal-200/60">
          Navigation
        </div>
        {cfg.nav.map(({ to, icon: Icon, label }) => {
          const active = isActive(to)
          return (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={`vitalis-nav-pill ${active ? 'active' : ''}`}
            >
              <Icon size={18} className={active ? 'text-teal-600 dark:text-teal-300' : 'text-white/70'} />
              <span>{label}</span>
              {active && <ChevronRight size={14} className="ml-auto opacity-70" />}
            </Link>
          )
        })}
      </nav>

      {/* User Card & Gateway Link in Sidebar */}
      <div className="pt-4 border-t border-white/15 space-y-3">
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15">
          <Avatar id={user.username} name={user.username} size={36} status="online" ring={false} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">{user.username}</p>
            <p className="text-[10px] text-teal-200/80 capitalize truncate">{user.role}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-full text-xs font-semibold text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition-all w-full cursor-pointer"
        >
          <LogOut size={14} />
          <span>Switch Role / Gateway</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="vitalis-staff-shell flex h-screen overflow-hidden">
      {/* Desktop Sidebar (Reference 3: Teal pill-sidebar) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 vitalis-staff-shell shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Clinical Canvas Area (Reference 3: Large rounded content canvas) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-2 sm:p-4 lg:p-6 lg:pl-0">
        <div className="vitalis-canvas flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Bar inside Canvas */}
          <header className="pb-4 mb-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Menu size={20} />
              </button>
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-teal-600 dark:text-teal-400">
                  {cfg.label}
                </span>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Hospital Operations
                </h2>
              </div>
            </div>

            {/* Top Right Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              <VerifiedBadge verified={true} />
              <DataSourceTag source="live" />
              <ThemeToggle />

              <button
                type="button"
                onClick={handleLogout}
                className="hidden sm:inline-flex btn-vitalis-ghost py-1.5 px-3.5 text-xs"
                title="Return to the Main Role Gateway"
              >
                <Users size={13} />
                <span>Switch Role</span>
              </button>
            </div>
          </header>

          {/* Dynamic Page Content */}
          <main className="flex-1 overflow-y-auto pr-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
