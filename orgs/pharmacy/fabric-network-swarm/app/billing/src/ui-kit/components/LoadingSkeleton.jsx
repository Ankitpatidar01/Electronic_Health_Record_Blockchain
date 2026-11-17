export default function LoadingSkeleton({ rows = 3, className = '' }) {
  return (
    <div className={`space-y-3 animate-pulse ${className}`} role="status" aria-label="Loading content">
      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-xl w-full" />
      ))}
    </div>
  )
}
