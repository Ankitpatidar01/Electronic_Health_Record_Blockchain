import { Shield, Mail, Phone, ChevronRight } from 'lucide-react'
import Avatar from './Avatar'

export default function StaffCard({
  id,
  name,
  role = 'Staff',
  department = 'Clinical Ops',
  email,
  phone,
  status = 'online',
  photoUrl,
  onAction,
  actionLabel = 'Manage',
  className = '',
}) {
  const roleBadges = {
    doctor: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-400/40',
    nurse: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-400/40',
    receptionist: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/40',
    pharmacist: 'bg-blue-500/15 text-blue-700 dark:text-sky-300 border-blue-400/40',
    medrecordofficer: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/40',
    admin: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-400/40',
  }

  const roleGradients = {
    doctor: 'bg-gradient-to-br from-sky-500/10 via-cyan-500/5 to-blue-500/10 dark:from-sky-950/40 dark:via-cyan-950/20 dark:to-blue-950/40 border-sky-200/90 dark:border-sky-800/60',
    nurse: 'bg-gradient-to-br from-purple-500/10 via-fuchsia-500/5 to-pink-500/10 dark:from-purple-950/40 dark:via-fuchsia-950/20 dark:to-pink-950/40 border-purple-200/90 dark:border-purple-800/60',
    receptionist: 'bg-gradient-to-br from-emerald-500/10 via-blue-500/5 to-green-500/10 dark:from-emerald-950/40 dark:via-sky-950/20 dark:to-green-950/40 border-emerald-200/90 dark:border-emerald-800/60',
    pharmacist: 'bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-emerald-500/10 dark:from-sky-950/40 dark:via-cyan-950/20 dark:to-emerald-950/40 border-blue-200/90 dark:border-sky-800/60',
    medrecordofficer: 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-yellow-500/10 dark:from-amber-950/40 dark:via-orange-950/20 dark:to-yellow-950/40 border-amber-200/90 dark:border-amber-800/60',
    admin: 'bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-violet-500/10 dark:from-indigo-950/40 dark:via-blue-950/20 dark:to-violet-950/40 border-indigo-200/90 dark:border-indigo-800/60',
  }

  const badgeClass = roleBadges[role.toLowerCase()] || 'bg-slate-100 text-slate-700 border-slate-200'
  const gradientClass = roleGradients[role.toLowerCase()] || 'bg-white dark:bg-slate-900/90 border-slate-200/90 dark:border-slate-800'

  return (
    <div
      className={`bento-card p-5 border rounded-3xl transition-all duration-200 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between ${gradientClass} ${className}`}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}>
            {role}
          </span>
          <span className="font-mono text-[10px] text-slate-400">{id}</span>
        </div>

        <div className="flex items-start gap-3.5 mb-3">
          <Avatar id={id} name={name} src={photoUrl} status={status} size={50} />
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight truncate">
              {name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {department}
            </p>
          </div>
        </div>

        <div className="space-y-1 mb-4 text-[11px] text-slate-500 dark:text-slate-400">
          {email && (
            <div className="flex items-center gap-2 truncate">
              <Mail size={12} className="text-slate-400 shrink-0" />
              <span className="truncate">{email}</span>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-2 truncate">
              <Phone size={12} className="text-slate-400 shrink-0" />
              <span className="truncate font-mono">{phone}</span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
          <Shield size={11} />
          MSP Verified
        </span>
        {onAction && (
          <button
            type="button"
            onClick={onAction}
            className="btn-vitalis-ghost py-1.5 px-3 text-xs"
          >
            <span>{actionLabel}</span>
            <ChevronRight size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
