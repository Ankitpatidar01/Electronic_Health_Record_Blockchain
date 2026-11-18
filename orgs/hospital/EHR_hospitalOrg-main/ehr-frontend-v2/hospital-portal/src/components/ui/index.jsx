// Shared UI components — Badge, Button, Card, Modal, Input, Spinner, StatusBadge

import { STATUS_COLORS, STATUS_LABELS } from '../../utils/api'
import { X, Loader2 } from 'lucide-react'

export function StatusBadge({ status }) {
  const tone = STATUS_COLORS[status] || 'is-neutral'
  return (
    <span className={`status-pill ${tone}`}>
      <span className="status-pill-dot" />
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export function Badge({ children, variant = 'default' }) {
  const variants = {
    default: 'is-neutral',
    blue:    'is-info',
    green:   'is-ok',
    red:     'is-danger',
    amber:   'is-warn',
    violet:  'is-violet',
  }
  return <span className={`status-pill ${variants[variant] || variants.default}`}>{children}</span>
}

export function Button({ children, variant = 'primary', size = 'md', className = '', loading = false, ...props }) {
  const variants = {
    primary:   'obs-btn',
    blue:      'obs-btn',
    secondary: 'obs-btn-ghost',
    ghost:     'obs-btn-ghost border-transparent bg-transparent',
    danger:    'inline-flex items-center justify-center gap-2 rounded-full font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
    success:   'inline-flex items-center justify-center gap-2 rounded-full font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
  }
  const sizes = {
    sm: '!px-3 !py-1.5 !text-xs',
    md: '!px-4 !py-2.5 !text-sm',
    lg: '!px-6 !py-3 !text-base',
  }
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`${variants[variant] || variants.primary} ${sizes[size]} ${className}`}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`premium-card ${className}`} {...props}>
      {children}
    </div>
  )
}

export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <input
        {...props}
        className={`w-full px-3 py-2 text-sm border rounded-lg bg-white text-slate-900 placeholder-slate-400
          border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent
          disabled:bg-slate-50 disabled:cursor-not-allowed ${error ? 'border-red-400 focus:ring-red-500' : ''} ${className}`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <textarea
        {...props}
        className={`w-full px-3 py-2 text-sm border rounded-lg bg-white text-slate-900 placeholder-slate-400
          border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent
          resize-none ${className}`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function Spinner({ size = 'md' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return <div role="status" aria-label="Loading" className={`${sizes[size]} border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin`} />
}

export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className={`relative bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 font-display">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
        <Icon size={20} className="text-slate-400" />
      </div>
      <p className="font-medium text-slate-700">{title}</p>
      <p className="text-sm text-slate-400 mt-1">{desc}</p>
    </div>
  )
}

export function Alert({ type = 'info', children }) {
  const styles = {
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error:   'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
  }
  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`p-3 rounded-xl border text-sm ${styles[type]}`}>
      {children}
    </div>
  )
}
