import { useEffect, useState } from 'react'

// Polls a service's /health endpoint so the header shows the real connection
// state instead of a fixed label. status: 'checking' | 'online' | 'degraded' | 'offline'
export function useServiceHealth(url, intervalMs = 20000) {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    if (!url) return undefined
    let cancelled = false

    const check = async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)
      try {
        const res = await fetch(url, { cache: 'no-store', signal: controller.signal })
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) setStatus('offline')
        else setStatus(body.status === 'degraded' ? 'degraded' : 'online')
      } catch {
        if (!cancelled) setStatus('offline')
      } finally {
        clearTimeout(timer)
      }
    }

    check()
    const id = setInterval(check, intervalMs)
    return () => { cancelled = true; clearInterval(id) }
  }, [url, intervalMs])

  return status
}

export const HEALTH_PILL = {
  checking: { tone: 'is-neutral', label: 'Checking API' },
  online:   { tone: 'is-ok',      label: 'Ledger API online' },
  degraded: { tone: 'is-warn',    label: 'API degraded' },
  offline:  { tone: 'is-danger',  label: 'API unreachable' },
}
