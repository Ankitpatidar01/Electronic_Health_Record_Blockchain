import { Star, Clock, Award, ChevronRight, Stethoscope } from 'lucide-react'
import Avatar from './Avatar'

export default function DoctorCard({
  id,
  name,
  specialty = 'General Medicine',
  qualifications = 'MBBS, MD',
  rating = '4.9',
  availability = 'Mon - Fri: 09:00 am - 01:00 pm',
  status = 'online', // 'online' | 'busy' | 'offline'
  photoUrl,
  onAction,
  actionLabel = 'Consult',
  className = '',
}) {
  return (
    <div
      className={`bento-card p-5 bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-3xl transition-all duration-200 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between ${className}`}
    >
      <div>
        {/* Top Header Row: Rating */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            {status === 'online' ? 'Available' : status === 'busy' ? 'In Consultation' : 'Off Duty'}
          </span>
          <div className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
            <Star size={12} className="fill-amber-400 text-amber-400" />
            <span>{rating}</span>
          </div>
        </div>

        {/* Doctor Info */}
        <div className="flex items-start gap-3.5 mb-3">
          <Avatar id={id} name={name} src={photoUrl} status={status} size={56} />
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight truncate">
              {name.startsWith('Dr.') ? name : `Dr. ${name}`}
            </h3>
            <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 mt-0.5 truncate">
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
          <Clock size={13} className="text-teal-500 shrink-0" />
          <span className="truncate">{availability}</span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-slate-400">{id || 'Verified MSP'}</span>
        <button
          type="button"
          onClick={onAction}
          className="btn-vitalis-pill py-2 px-4 text-xs cursor-pointer shadow-xs"
        >
          <span>{actionLabel}</span>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}
