import { Radio, Database, AlertCircle } from 'lucide-react'

export default function DataSourceTag({ source = 'live', className = '' }) {
  const configs = {
    live: {
      label: 'Live Ledger',
      icon: Radio,
      classNames: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
      iconClass: 'text-emerald-500 animate-pulse'
    },
    cached: {
      label: 'Cached Record',
      icon: Database,
      classNames: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
      iconClass: 'text-sky-500'
    },
    demo: {
      label: 'Demo / Fallback',
      icon: AlertCircle,
      classNames: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
      iconClass: 'text-amber-500'
    }
  }

  const current = configs[source] || configs.live
  const Icon = current.icon

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${current.classNames} ${className}`}>
      <Icon size={12} className={current.iconClass} />
      <span>{current.label}</span>
    </span>
  )
}
