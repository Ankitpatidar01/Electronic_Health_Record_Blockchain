import React from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Network, Bot, ArrowRightLeft, Shield, Database, ScrollText, LogOut, Activity, Bell, BarChart3, Boxes } from 'lucide-react'
import { useDashboardSocket } from '../../hooks/useDashboardSocket'
import { allowedViews } from '../../config/roleViews'
import ThemeToggle from '../ThemeToggle'

const navItems = [
  { path: '/overview', key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { path: '/network', key: 'network', label: 'Network', icon: Network },
  { path: '/agents', key: 'agents', label: 'Agents', icon: Bot },
  { path: '/transactions', key: 'transactions', label: 'Transactions', icon: ArrowRightLeft },
  { path: '/analytics', key: 'transactions', label: 'Analytics', icon: BarChart3 },
  { path: '/explorer', key: 'transactions', label: 'Explorer', icon: Boxes },
  { path: '/security', key: 'security', label: 'Security', icon: Shield },
  { path: '/ipfs', key: 'ipfs', label: 'IPFS', icon: Database },
  { path: '/logs', key: 'logs', label: 'Logs', icon: ScrollText },
  { path: '/alerts', key: 'alerts', label: 'Alerts', icon: Bell },
]

export function Layout({ user, onLogout }) {
  const { isConnected, lastBlock, events } = useDashboardSocket()
  return (
    <div className="dashboard-shell min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="dashboard-topbar sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
        {/* Main Navbar: Branding, Live Telemetry Status, User Profile */}
        <div className="border-b border-slate-100 dark:border-slate-800/60 px-4 py-3 md:px-8">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
            {/* Brand Logo & Title */}
            <div className="flex items-center gap-3">
              <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="CareGrid NITW" className="h-8 w-8 object-contain" />
              <div>
                <div className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                  CareGrid <span className="text-blue-600 dark:text-cyan-400">Observatory</span>
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400">
                  NIT Warangal Health Center · Live Telemetry
                </div>
              </div>
            </div>

            {/* Live Stream Status Badge (Center) */}
            <div className="hidden sm:flex items-center gap-3 text-[13px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 px-3.5 py-1.5 rounded-full">
              <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse' : 'bg-amber-500'}`} />
                {isConnected ? 'Live Stream Active' : 'Connecting Stream'}
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-slate-500 dark:text-slate-400 text-xs">
                Latest block <b className="font-semibold text-slate-800 dark:text-cyan-400 font-mono">#{lastBlock ?? '—'}</b>
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-slate-500 dark:text-slate-400 text-xs">
                <b className="font-semibold text-slate-800 dark:text-slate-200">{events.length}</b> events
              </span>
            </div>

            {/* User Controls & Logout */}
            <div className="dashboard-user flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="max-w-36 truncate text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                  {user?.username || user?.userId}
                </div>
                <div className="text-[11px] capitalize text-slate-500 dark:text-slate-400">
                  {user?.role}
                </div>
              </div>
              <span className={`dashboard-live-dot ${isConnected ? 'is-live' : ''}`} title={isConnected ? 'Live stream connected' : 'Stream not connected'} />
              <ThemeToggle />
              <button onClick={onLogout} className="dashboard-logout" aria-label="Log out">
                <LogOut size={15} />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dedicated Subnavbar: Navigation Options Row */}
        <nav className="dashboard-subnav px-4 py-2 md:px-8 bg-white/70 dark:bg-slate-900/70" aria-label="Dashboard views navigation">
          <div className="mx-auto flex max-w-[1600px] items-center gap-1.5 overflow-x-auto no-scrollbar">
            {navItems.filter(item => allowedViews(user?.role).includes(item.key)).map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `dashboard-nav-link whitespace-nowrap !px-4 !py-1.5 !text-[13px] !font-semibold rounded-full transition-all ${
                  isActive
                    ? '!bg-blue-600 !text-white shadow-xs shadow-blue-500/20 dark:!bg-cyan-500 dark:!text-slate-950 dark:shadow-cyan-500/30 font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <item.icon size={15} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1600px] p-4 md:p-8"><Outlet /></main>
    </div>
  )
}
