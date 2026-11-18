import { ShieldCheck, ExternalLink } from 'lucide-react'

export default function VerifiedBadge({
  blockNumber,
  txId,
  verified = true,
  onClick,
  className = ''
}) {
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-xs transition-all ${
        verified
          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
      } ${onClick ? 'cursor-pointer hover:shadow-sm' : ''} ${className}`}
    >
      <ShieldCheck size={13} className={verified ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'} />
      <span>{verified ? 'Verified on-chain' : 'Pending verification'}</span>
      {blockNumber !== undefined && blockNumber !== null && (
        <span className="font-mono text-[10px] opacity-80 pl-1 border-l border-emerald-300 dark:border-emerald-800">
          #{blockNumber}
        </span>
      )}
      {onClick && <ExternalLink size={10} className="opacity-60" />}
    </span>
  )
}
