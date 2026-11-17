import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function HashChip({ hash = '', label = '', truncate = true, length = 8 }) {
  const [copied, setCopied] = useState(false)

  if (!hash) return <span className="text-xs text-slate-400 font-mono italic">None</span>

  const displayHash = truncate && hash.length > length * 2
    ? `${hash.slice(0, length)}...${hash.slice(-length)}`
    : hash

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(hash)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={copyToClipboard}
      title={`Click to copy: ${hash}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 font-mono text-xs text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 transition-colors group cursor-pointer"
    >
      {label && <span className="text-[10px] uppercase tracking-wider text-slate-400 font-sans mr-0.5">{label}:</span>}
      <span className="font-semibold">{displayHash}</span>
      {copied ? (
        <Check size={12} className="text-emerald-500" />
      ) : (
        <Copy size={12} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
      )}
    </button>
  )
}
