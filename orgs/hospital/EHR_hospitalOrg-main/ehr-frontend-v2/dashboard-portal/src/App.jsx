import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import Overview from './pages/Overview'
import Network from './pages/Network'
import Transactions from './pages/Transactions'
import Security from './pages/Security'
import IPFS from './pages/IPFS'
import Logs from './pages/Logs'
import Agents from './pages/Agents'
import Alerts from './pages/Alerts'
import Analytics from './pages/Analytics'
import Explorer from './pages/Explorer'
import DoctorAgent from './pages/DoctorAgent'
import NurseAgent from './pages/NurseAgent'
import PharmacyAgent from './pages/PharmacyAgent'
import LabAgent from './pages/LabAgent'
import { AgentDashboard } from './components/AgentDashboard'
import { hasDashboardAuth, loginDashboard, logoutDashboard, readDashboardUser } from './services/api'
import { allowedViews } from './config/roleViews'

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      onLogin(await loginDashboard(username, password))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 dark:bg-[#080d1c] p-4">
      <form onSubmit={submit} className="premium-card w-full max-w-md p-8 space-y-5">
        <div>
          <div className="inline-block p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 mb-3">
            <img src="/logo.svg" alt="CareGrid NITW" className="h-8 w-8 object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard sign in</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Use your hospital account. Access is determined by your assigned role.</p>
        </div>
        {error && <div role="alert" className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm">{error}</div>}
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Username
          <input id="username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} className="mt-1.5 block w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm" required placeholder="e.g. hospitaladmin" />
        </label>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Password
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1.5 block w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm" required placeholder="••••••••" />
        </label>
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 font-bold tracking-tight disabled:opacity-50 transition-colors shadow-sm cursor-pointer">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-500">Default demo: <code className="font-mono text-slate-600 dark:text-slate-300">hospitaladmin</code> / <code className="font-mono text-slate-600 dark:text-slate-300">hadminpw</code></p>
        </div>
      </form>
    </main>
  )
}

function AccessDenied({ onLogout }) { return <main className="min-h-screen grid place-items-center p-6"><section className="max-w-lg bg-white border rounded-xl p-8"><h1 className="text-2xl font-bold">Dashboard access unavailable</h1><p className="mt-3 text-slate-600">This account’s role is not enabled for dashboard views on this deployment.</p><button onClick={onLogout} className="mt-5 rounded-lg bg-slate-900 text-white px-4 py-2">Sign out</button></section></main> }

function App() {
  const [user, setUser] = useState(() => hasDashboardAuth() ? readDashboardUser() : null)
  useEffect(() => { const unauthorized = () => { logoutDashboard(); setUser(null) }; window.addEventListener('dashboard:unauthorized', unauthorized); return () => window.removeEventListener('dashboard:unauthorized', unauthorized) }, [])
  const views = allowedViews(user?.role)
  const home = views.includes('overview')
    ? '/overview'
    : views.includes('agents')
      ? '/agents'
      : views.includes('agent-doctor')
        ? '/agents/doctor'
        : views.includes('agent-nurse')
          ? '/agents/nurse'
          : views.includes('agent-pharmacy')
            ? '/agents/pharmacy'
            : views.includes('agent-lab')
              ? '/agents/lab'
              : '/denied'
  const basename = window.location.pathname.startsWith('/dashboard') ? '/dashboard' : undefined
  return <BrowserRouter basename={basename} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes>
    <Route path="/login" element={user ? <Navigate to={home} replace /> : <Login onLogin={setUser} />} />
    <Route path="/denied" element={user && !views.length ? <AccessDenied onLogout={() => { logoutDashboard(); setUser(null) }} /> : <Navigate to={home} replace />} />
    <Route path="/" element={user ? <Layout user={user} onLogout={() => { logoutDashboard(); setUser(null) }} /> : <Navigate to="/login" replace />}>
      <Route index element={<Navigate to={home} replace />} />
      <Route path="overview" element={views.includes('overview') ? <Overview /> : <Navigate to={home} replace />} />
      <Route path="network" element={views.includes('network') ? <Network /> : <Navigate to={home} replace />} />
      <Route path="agents" element={views.includes('agents') ? <Agents /> : <Navigate to={home} replace />} />
      <Route path="agents/doctor" element={views.includes('agents') || views.includes('agent-doctor') ? <DoctorAgent /> : <Navigate to={home} replace />} />
      <Route path="agents/nurse" element={views.includes('agents') || views.includes('agent-nurse') ? <NurseAgent /> : <Navigate to={home} replace />} />
      <Route path="agents/pharmacy" element={views.includes('agents') || views.includes('agent-pharmacy') ? <PharmacyAgent /> : <Navigate to={home} replace />} />
      <Route path="agents/lab" element={views.includes('agents') || views.includes('agent-lab') ? <LabAgent /> : <Navigate to={home} replace />} />
      <Route path="agents/:agentId" element={views.includes('agents') ? <AgentDashboard /> : <Navigate to={home} replace />} />
      <Route path="transactions" element={views.includes('transactions') ? <Transactions /> : <Navigate to={home} replace />} />
      <Route path="analytics" element={views.includes('transactions') ? <Analytics /> : <Navigate to={home} replace />} />
      <Route path="explorer" element={views.includes('transactions') ? <Explorer /> : <Navigate to={home} replace />} />
      <Route path="security" element={views.includes('security') ? <Security /> : <Navigate to={home} replace />} />
      <Route path="ipfs" element={views.includes('ipfs') ? <IPFS /> : <Navigate to={home} replace />} />
      <Route path="logs" element={views.includes('logs') ? <Logs /> : <Navigate to={home} replace />} />
      <Route path="alerts" element={views.includes('alerts') ? <Alerts /> : <Navigate to={home} replace />} />
    </Route><Route path="*" element={<Navigate to={user ? home : '/login'} replace />} />
  </Routes></BrowserRouter>
}
export default App
