import { Star, Clock, Award, ChevronRight, Stethoscope, ShieldCheck, ShieldAlert, Trash2, Camera } from 'lucide-react'
import Avatar from './Avatar'

export default function DoctorCard({
  id,
  name,
  specialty = 'General Medicine',
  qualifications = 'MBBS, MD',
  rating = '4.9',
  availability = 'Mon - Fri: 09:00 am - 01:00 pm',
  status = 'online', // 'online' | 'busy' | 'offline'
  accountStatus = 'active', // 'active' | 'revoked'
  photoUrl,
  onAction,
  actionLabel = 'Photo',
  onRevokeToggle,
  onDelete,
  isProtected = false,
  className = '',
}) {
  const isRevoked = accountStatus === 'revoked'

  return (
    <div
      className={`bento-card p-5 bg-gradient-to-br from-white via-sky-50/40 to-cyan-50/50 dark:from-slate-900/95 dark:via-sky-950/20 dark:to-cyan-950/30 border ${
        isRevoked
          ? 'border-rose-300 dark:border-rose-900/60 ring-1 ring-rose-500/20'
          : 'border-slate-200/90 dark:border-slate-800/80 hover:border-blue-500/40 dark:hover:border-sky-400/40'
      } rounded-3xl transition-all duration-200 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between ${className}`}
    >
      <div>
        {/* Top Header Row: Status & Rating */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {isRevoked ? (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Revoked
              </span>
            ) : (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-sky-950/60 text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-sky-800">
                {status === 'online' ? 'Available' : status === 'busy' ? 'In Consultation' : 'Off Duty'}
              </span>
            )}
            <span className="font-mono text-[10px] text-slate-400">{id}</span>
          </div>

          <div className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
            <Star size={12} className="fill-amber-400 text-amber-400" />
            <span>{rating}</span>
          </div>
        </div>

        {/* Doctor Info */}
        <div className="flex items-start gap-3.5 mb-3">
          <Avatar id={id} name={name} src={photoUrl} status={isRevoked ? 'offline' : status} size={56} />
          <div className="min-w-0 flex-1">
            <h3 className={`font-bold text-base leading-tight truncate ${isRevoked ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-white'}`}>
              {name.startsWith('Dr.') ? name : `Dr. ${name}`}
            </h3>
            <p className="text-xs font-semibold text-blue-600 dark:text-sky-400 mt-0.5 truncate">
              {specialty}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1 truncate">
              <Award size={12} className="shrink-0 text-slate-400" />
              <span className="truncate">{qualifications}</span>
            </div>
          </div>
        </div>

        {/* Schedule / Hours */}
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2 mb-4">
          <Clock size={13} className="text-blue-500 shrink-0" />
          <span className="truncate">{availability}</span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        {onAction && (
          <button
            type="button"
            onClick={onAction}
            className="btn-vitalis-ghost py-1.5 px-2.5 text-xs flex items-center gap-1 text-slate-600 dark:text-slate-300"
            title="Upload Profile Photo"
          >
            <Camera size={12} />
            <span>{actionLabel}</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          {isProtected ? (
            <span className="text-[10px] font-semibold text-slate-400 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              Root Admin
            </span>
          ) : (
            <>
              {onRevokeToggle && (
                <button
                  type="button"
                  onClick={onRevokeToggle}
                  className={`py-1.5 px-2.5 text-xs rounded-xl font-semibold transition-all flex items-center gap-1 ${
                    isRevoked
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800'
                  }`}
                  title={isRevoked ? 'Reinstate staff access' : 'Revoke staff access'}
                >
                  {isRevoked ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                  <span>{isRevoked ? 'Reinstate' : 'Revoke'}</span>
                </button>
              )}

              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition-colors"
                  title="Permanently remove staff member"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

