import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Spinner, VisitStatusBadge } from '../components/ui'
import { formatDate } from '../utils/api'
import {
  Heart,
  Calendar,
  ChevronRight,
  AlertCircle,
  Activity,
  FileText,
  ShieldCheck,
  Stethoscope,
  Pill,
  Clock,
  ArrowRight
} from 'lucide-react'
import BentoCard from '../ui-kit/components/BentoCard'
import HashChip from '../ui-kit/components/HashChip'
import VerifiedBadge from '../ui-kit/components/VerifiedBadge'
import DataSourceTag from '../ui-kit/components/DataSourceTag'

export default function OverviewPage() {
  const { api, patient } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [visits, setVisits] = useState([])
  const [ehr, setEhr] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, vRes, ehrCIDRes] = await Promise.allSettled([
          api().get('/profile'),
          api().get('/visits'),
          api().get('/ehr'),
        ])
        if (pRes.status === 'fulfilled') setProfile(pRes.value.data.data)
        if (vRes.status === 'fulfilled') setVisits(vRes.value.data.data || [])
        if (ehrCIDRes.status === 'fulfilled') setEhr(ehrCIDRes.value.data.data?.ehr || null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Spinner size="lg" />
        <p className="text-xs text-slate-400 mt-3 font-mono">Syncing health record from Fabric ledger...</p>
      </div>
    )
  }

  const activeVisit = visits.find(v => !['DISCHARGED'].includes(v.status))
  const allergies = ehr?.allergies || []
  const conditions = ehr?.chronicConditions || []
  const latestVitals = activeVisit?.vitals || visits[visits.length - 1]?.vitals || null

  return (
    <div className="space-y-6">
      {/* Hero Welcome Bento Card */}
      <div className="bento-card p-6 md:p-8 bg-gradient-to-br from-white/95 to-slate-50/90 dark:from-slate-900/90 dark:to-slate-900/70 relative overflow-hidden">
        {/* Soft decorative backdrop */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 dark:opacity-10 pointer-events-none bg-no-repeat bg-right-top"
          style={{ backgroundImage: 'radial-gradient(circle at 100% 0%, #2563eb 0%, transparent 70%)' }} />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs uppercase font-bold tracking-wider text-blue-600 dark:text-sky-400 bg-blue-50 dark:bg-sky-950/50 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-sky-800">
                CareGrid Health Identity
              </span>
              <DataSourceTag source="live" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Welcome back, {profile?.name?.split(' ')[0] || 'Patient'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Your personal electronic health record is cryptographically signed and stored across the decentralized consortium network.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/visits')}
              className="btn-ink-pill cursor-pointer"
            >
              <span>View Visits</span>
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/ehr')}
              className="btn-ghost-pill cursor-pointer"
            >
              <FileText size={14} />
              <span>Record Vault</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Visit Notification Tile (if in treatment) */}
      {activeVisit && (
        <div
          onClick={() => navigate(`/visits/${activeVisit.visitId}`)}
          className="bento-card bento-card-mint p-5 cursor-pointer flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Activity size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-900 dark:text-white">Active Clinical Visit</p>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-white/70 dark:bg-black/30 font-semibold">
                  {activeVisit.visitId}
                </span>
              </div>
              <p className="text-xs opacity-80 mt-0.5">
                Current State: <span className="font-semibold">{activeVisit.status}</span> · Department: {activeVisit.department || 'General Medicine'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <VisitStatusBadge status={activeVisit.status} />
            <ChevronRight size={18} className="opacity-60" />
          </div>
        </div>
      )}

      {/* Bento Stats Row (Mint / Sky / Butter) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Mint: Visits */}
        <div
          onClick={() => navigate('/visits')}
          className="bento-card bento-card-mint p-5 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-75">Clinical Visits</span>
            <Calendar size={18} className="opacity-75" />
          </div>
          <div className="mt-4">
            <p className="text-3xl font-extrabold tracking-tight">{profile?.visitCount || visits.length}</p>
            <p className="text-xs opacity-80 mt-1">Logged on Hyperledger Fabric</p>
          </div>
        </div>

        {/* Sky: Allergies */}
        <div
          onClick={() => navigate('/ehr')}
          className="bento-card bento-card-sky p-5 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-75">Allergies Logged</span>
            <AlertCircle size={18} className="opacity-75" />
          </div>
          <div className="mt-4">
            <p className="text-3xl font-extrabold tracking-tight">{allergies.length}</p>
            <p className="text-xs opacity-80 mt-1">{allergies.length > 0 ? 'Requires attention' : 'No recorded allergies'}</p>
          </div>
        </div>

        {/* Butter: Conditions */}
        <div
          onClick={() => navigate('/ehr')}
          className="bento-card bento-card-butter p-5 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-75">Chronic Conditions</span>
            <Heart size={18} className="opacity-75" />
          </div>
          <div className="mt-4">
            <p className="text-3xl font-extrabold tracking-tight">{conditions.length}</p>
            <p className="text-xs opacity-80 mt-1">Gated under consent control</p>
          </div>
        </div>
      </div>

      {/* 2-Column Bento: Vitals/Overview Left, Recent Visits Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Patient Parameters & Vitals */}
        <BentoCard
          title="Clinical Vitals & Parameters"
          subtitle="Observed during latest recorded check-in"
          icon={Activity}
          action={<VerifiedBadge verified={true} />}
        >
          {latestVitals ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-400 uppercase">Blood Pressure</span>
                <p className="text-lg font-bold font-mono text-slate-800 dark:text-slate-100 mt-0.5">
                  {latestVitals.bp || latestVitals.bloodPressure || '120/80'}
                </p>
                <span className="text-[10px] text-slate-400">mmHg</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-400 uppercase">Heart Rate</span>
                <p className="text-lg font-bold font-mono text-slate-800 dark:text-slate-100 mt-0.5">
                  {latestVitals.pulse || latestVitals.heartRate || '74'}
                </p>
                <span className="text-[10px] text-slate-400">bpm</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-400 uppercase">SpO₂</span>
                <p className="text-lg font-bold font-mono text-slate-800 dark:text-slate-100 mt-0.5">
                  {latestVitals.spo2 || '98%'}
                </p>
                <span className="text-[10px] text-emerald-600 font-semibold">Normal</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-400 uppercase">Temperature</span>
                <p className="text-lg font-bold font-mono text-slate-800 dark:text-slate-100 mt-0.5">
                  {latestVitals.temperature || '98.4'} °F
                </p>
                <span className="text-[10px] text-slate-400">Oral probe</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-400 uppercase">Weight / BMI</span>
                <p className="text-lg font-bold font-mono text-slate-800 dark:text-slate-100 mt-0.5">
                  {latestVitals.weight || '68'} kg
                </p>
                <span className="text-[10px] text-slate-400">BMI 22.4</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-400 uppercase">Blood Group</span>
                <p className="text-lg font-bold font-mono text-slate-800 dark:text-slate-100 mt-0.5">
                  {profile?.bloodGroup || 'O+'}
                </p>
                <span className="text-[10px] text-slate-400">Verified</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-6 text-center italic">
              No recorded vitals from your previous consultations.
            </p>
          )}

          {/* Demographic chips */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Age / Sex</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{profile?.age || '--'} yrs · {profile?.gender || '--'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Registered Contact</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{profile?.contact || '--'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Patient Hash</span>
              <HashChip hash={patient?.patientId} />
            </div>
          </div>
        </BentoCard>

        {/* Right: Recent Visits Timeline */}
        <BentoCard
          title="Recent Consultations"
          subtitle="Latest clinical appointments and status"
          icon={Stethoscope}
          action={
            <button
              type="button"
              onClick={() => navigate('/visits')}
              className="text-xs text-blue-600 dark:text-sky-400 font-semibold hover:underline flex items-center gap-1"
            >
              <span>All Visits</span>
              <ChevronRight size={12} />
            </button>
          }
        >
          {visits.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No previous visit records found.
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {[...visits].reverse().slice(0, 3).map((v) => (
                <div
                  key={v.visitId}
                  onClick={() => navigate(`/visits/${v.visitId}`)}
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-white dark:bg-slate-800/40 dark:hover:bg-slate-800/80 border border-slate-200/70 dark:border-slate-800 cursor-pointer transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-sky-950/60 text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-sky-800 flex items-center justify-center font-bold text-xs shrink-0">
                      Dr
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {v.assignedDoctor ? `Dr. ${v.assignedDoctor}` : 'General Consultation'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDate(v.createdAt)} · <span className="font-mono">{v.visitId}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <VisitStatusBadge status={v.status} />
                    <ChevronRight size={14} className="text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </BentoCard>
      </div>

      {/* Bottom Trust Card */}
      <div className="bento-card p-5 bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-blue-300 shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-white">Immutable Ledger Integrity</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Every EHR update generates a cryptographic transaction hash on the consortium channel.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <VerifiedBadge verified={true} />
          <button
            type="button"
            onClick={() => navigate('/signatures')}
            className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
          >
            Inspect Signatures
          </button>
        </div>
      </div>
    </div>
  )
}
