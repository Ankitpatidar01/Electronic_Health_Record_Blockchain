import { Activity, AlertCircle, Heart, ChevronRight, Calendar } from 'lucide-react'
import Avatar from './Avatar'

export default function PatientCard({
  id,
  name,
  age,
  gender,
  bloodGroup = 'O+',
  allergies = [],
  conditions = [],
  activeVisit,
  lastVisitDate,
  photoUrl,
  onAction,
  actionLabel = 'Open Chart',
  className = '',
}) {
  return (
    <div
      className={`bento-card p-5 bg-gradient-to-br from-white via-emerald-50/20 to-blue-50/30 dark:from-slate-900/95 dark:via-emerald-950/20 dark:to-sky-950/30 border border-slate-200/90 dark:border-slate-800/80 rounded-3xl transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-emerald-500/40 dark:hover:border-emerald-400/40 flex flex-col justify-between ${className}`}
    >
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            {id}
          </span>
          {activeVisit ? (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active Visit
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 font-medium">Inactive</span>
          )}
        </div>

        {/* Patient Profile */}
        <div className="flex items-start gap-3.5 mb-3">
          <Avatar id={id} name={name} src={photoUrl} size={52} />
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight truncate">
              {name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {age ? `${age} yrs` : '--'} · {gender || '--'} · <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono">{bloodGroup}</span>
            </p>
          </div>
        </div>

        {/* Clinical Chips (Allergies & Conditions) */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {allergies.length > 0 ? (
            allergies.slice(0, 2).map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60"
              >
                <AlertCircle size={10} />
                <span className="truncate max-w-[90px]">{typeof a === 'string' ? a : a.substance}</span>
              </span>
            ))
          ) : (
            <span className="text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800/40 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-800">
              No known allergies
            </span>
          )}
          {conditions.slice(0, 1).map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60"
            >
              <Heart size={10} />
              <span className="truncate max-w-[90px]">{typeof c === 'string' ? c : c.condition}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          <Calendar size={11} />
          {lastVisitDate || 'Encounter record'}
        </span>
        <button
          type="button"
          onClick={onAction}
          className="btn-vitalis-pill py-1.5 px-3.5 text-xs cursor-pointer shadow-xs"
        >
          <span>{actionLabel}</span>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}
