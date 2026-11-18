import { useState, useEffect } from 'react'

const GRADIENTS = [
  'linear-gradient(135deg, #1E4DFF, #38bdf8)',
  'linear-gradient(135deg, #2563eb, #A8E6CF)',
  'linear-gradient(135deg, #8B5CF6, #B7D3FF)',
  'linear-gradient(135deg, #EC4899, #F8C8DC)',
  'linear-gradient(135deg, #F59E0B, #FFE08A)',
  'linear-gradient(135deg, #10B981, #38bdf8)',
]

function hashString(str = '') {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Avatar({
  src,
  name = 'User',
  id,
  size = 48,
  status, // 'online' | 'busy' | 'offline' | undefined
  ring = true,
  className = '',
}) {
  const [imgError, setImgError] = useState(false)
  const [localPhoto, setLocalPhoto] = useState(null)

  // Check client-side uploaded photo from localStorage if present
  useEffect(() => {
    if (id && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`vitalis_avatar_${id}`)
      if (stored) setLocalPhoto(stored)
    }
  }, [id])

  const effectiveSrc = localPhoto || src
  const initials = getInitials(name)
  const gradient = GRADIENTS[hashString(name + (id || '')) % GRADIENTS.length]

  const sizeClasses = {
    32: 'w-8 h-8 text-xs',
    40: 'w-10 h-10 text-xs',
    48: 'w-12 h-12 text-sm',
    56: 'w-14 h-14 text-base',
    64: 'w-16 h-16 text-lg',
    80: 'w-20 h-20 text-xl',
  }

  const currentSizeClass = sizeClasses[size] || 'w-12 h-12 text-sm'

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <div
        className={`rounded-2xl transition-all ${
          ring ? 'p-[2.5px] bg-gradient-to-tr from-[#1E4DFF] via-[#2563eb] to-[#38bdf8] shadow-xs' : ''
        }`}
      >
        <div
          className={`${currentSizeClass} rounded-[14px] overflow-hidden flex items-center justify-center font-bold text-white select-none`}
          style={{ background: effectiveSrc && !imgError ? '#FFFFFF' : gradient }}
        >
          {effectiveSrc && !imgError ? (
            <img
              src={effectiveSrc}
              alt={name}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="tracking-wider drop-shadow-xs">{initials}</span>
          )}
        </div>
      </div>

      {status && (
        <span
          className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
            status === 'online'
              ? 'bg-emerald-500'
              : status === 'busy'
              ? 'bg-amber-500'
              : 'bg-slate-400'
          }`}
          title={`Status: ${status}`}
        />
      )}
    </div>
  )
}
