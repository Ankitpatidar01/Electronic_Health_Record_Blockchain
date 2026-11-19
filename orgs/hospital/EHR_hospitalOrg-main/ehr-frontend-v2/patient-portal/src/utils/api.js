import axios from 'axios'

// Browser-facing API URLs. Override at build/dev time with VITE_PATIENT_API_URL
// and VITE_DIGILOCKER_API_URL (docker-compose passes both).
const trim = (url) => String(url || '').replace(/\/+$/, '')
export const BASE = trim(import.meta.env.VITE_PATIENT_API_URL) || '/api/patient'
export const DIGILOCKER_BASE = trim(import.meta.env.VITE_DIGILOCKER_API_URL) || 'http://localhost:4007'

export const patientApi = axios.create({ baseURL: BASE, timeout: 30000 })

// Idempotent reads are retried on network errors and 502/503/504 so a peer or
// gateway that is briefly restarting does not surface as a failure.
function withRetry(client, retries = 2) {
  client.interceptors.response.use(undefined, async (error) => {
    const config = error.config
    const status = error.response?.status
    const transient = !error.response || [502, 503, 504].includes(status)
    if (!config || (config.method || 'get').toLowerCase() !== 'get' || !transient) throw error
    config.__attempt = (config.__attempt || 0) + 1
    if (config.__attempt > retries) throw error
    await new Promise(resolve => setTimeout(resolve, 400 * 2 ** (config.__attempt - 1)))
    return client.request(config)
  })
  return client
}

function createClient(baseURL, token, onUnauthorized) {
  const client = withRetry(axios.create({ baseURL, timeout: 45000 }))
  if (token) client.defaults.headers.common['Authorization'] = `Bearer ${token}`
  if (onUnauthorized) {
    client.interceptors.response.use(undefined, (error) => {
      if (error.response?.status === 401 && token) onUnauthorized()
      throw error
    })
  }
  return client
}

export const createPatientClient = (token, onUnauthorized) => createClient(BASE, token, onUnauthorized)
export const createDigilockerClient = (token, onUnauthorized) => createClient(DIGILOCKER_BASE, token, onUnauthorized)

// One readable sentence for any failed request.
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.error) return error.response.data.error
  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.'
  if (error?.request && !error.response) return 'The service is not reachable right now. Check that it is running and try again.'
  return error?.message || fallback
}

export function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// tone = modifier class for the shared .status-pill component
export const VISIT_STATUS_INFO = {
  OPEN:              { label: 'Open',              tone: 'is-neutral' },
  WITH_DOCTOR:       { label: 'With Doctor',       tone: 'is-info' },
  WITH_NURSE:        { label: 'With Nurse',        tone: 'is-violet' },
  WITH_LAB:          { label: 'At Laboratory',     tone: 'is-warn' },
  VISIT_FINALIZED:   { label: 'Visit Complete',    tone: 'is-ok' },
  RECORD_FINALIZED:  { label: 'Record Finalized',  tone: 'is-ok' },
  CLAIM_SUBMITTED:   { label: 'Claim Submitted',   tone: 'is-warn' },
  CLAIM_UNDER_AUDIT: { label: 'Claim Under Audit', tone: 'is-warn' },
  CLAIM_APPROVED:    { label: 'Claim Approved',    tone: 'is-ok' },
  CLAIM_REJECTED:    { label: 'Claim Rejected',    tone: 'is-danger' },
  DISCHARGED:        { label: 'Discharged',        tone: 'is-neutral' },
}
