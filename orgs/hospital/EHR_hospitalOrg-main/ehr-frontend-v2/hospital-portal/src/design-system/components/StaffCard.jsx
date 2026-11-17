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
    doctor: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    nurse: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
    receptionist: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    pharmacist: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30',
    medrecordofficer: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    admin: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  }

  const badgeClass = roleBadges[role.toLowerCase()] || 'bg-slate-100 text-slate-700 border-slate-200'

  return (
    <div
      className={`bento-card p-5 bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-3xl transition-all duration-200 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between ${className}`}
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
