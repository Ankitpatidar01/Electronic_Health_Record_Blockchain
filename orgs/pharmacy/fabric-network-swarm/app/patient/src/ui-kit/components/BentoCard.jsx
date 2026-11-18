export default function BentoCard({
  title,
  subtitle,
  icon: Icon,
  badge,
  action,
  tint, // 'mint' | 'sky' | 'butter' | undefined
  className = '',
  children
}) {
  const tintClass =
    tint === 'mint'
      ? 'bento-card-mint'
      : tint === 'sky'
      ? 'bento-card-sky'
      : tint === 'butter'
      ? 'bento-card-butter'
      : 'bg-white dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800'

  return (
    <div className={`bento-card p-5 md:p-6 border ${tintClass} ${className}`}>
      {(title || Icon || badge || action) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-slate-700 dark:text-slate-300" />
              </div>
            )}
            <div className="min-w-0">
              {title && <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base leading-tight truncate">{title}</h3>}
              {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {badge}
            {action}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
