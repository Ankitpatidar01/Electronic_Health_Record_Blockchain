import React from 'react'

export function MetricCard({ title, value, icon: Icon, trend, tone = 'blue' }) {
  const toneClasses = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    violet: 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400',
    cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400',
  }[tone] || 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'

  return (
    <div className="premium-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</h3>
        {Icon && (
          <div className={`p-2 rounded-xl ${toneClasses}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value ?? '0'}</div>
        {trend !== undefined && (
          <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${trend > 0 ? 'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : trend < 0 ? 'bg-rose-100/70 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </div>
        )}
      </div>
    </div>
  )
}

