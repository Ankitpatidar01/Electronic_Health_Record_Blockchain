import axios from 'axios'

const ROLE_APIS = {
  receptionist:     '/api/hospital/peer0',
  admin:            '/api/hospital/peer0',
  doctor:           '/api/hospital/peer1',
  nurse:            '/api/hospital/peer2',
  pharmacist:       '/api/hospital/peer2',
  medrecordofficer: '/api/hospital/peer2',
}

export function getApiBase(role) {
  return ROLE_APIS[role] || '/api/hospital/peer0'
}

export function createApiClient(token, role) {
  const base = getApiBase(role)
  const client = axios.create({ baseURL: base })
  if (token) client.defaults.headers.common['Authorization'] = `Bearer ${token}`
  return client
}

export async function loginUser(username, password) {
  const apis = [
    '/api/hospital/peer0',
    '/api/hospital/peer1',
    '/api/hospital/peer2',
  ]
  for (const base of apis) {
    try {
      const res = await axios.post(`${base}/auth/login`, { username, password })
      if (res.data.success) return { ...res.data, apiBase: base }
    } catch {}
  }
  throw new Error('Invalid credentials')
}

// Tone classes for the shared .status-pill component.
export const STATUS_COLORS = {
  OPEN:              'is-neutral',
  WITH_DOCTOR:       'is-info',
  WITH_NURSE:        'is-violet',
  WITH_LAB:          'is-warn',
  VISIT_FINALIZED:   'is-ok',
  RECORD_FINALIZED:  'is-ok',
  CLAIM_SUBMITTED:   'is-warn',
  CLAIM_UNDER_AUDIT: 'is-warn',
  CLAIM_APPROVED:    'is-ok',
  CLAIM_REJECTED:    'is-danger',
  DISCHARGED:        'is-neutral',
}

export const STATUS_LABELS = {
  OPEN:              'Open',
  WITH_DOCTOR:       'With Doctor',
  WITH_NURSE:        'With Nurse',
  WITH_LAB:          'With Lab',
  VISIT_FINALIZED:   'Visit Finalized',
  RECORD_FINALIZED:  'Record Finalized',
  CLAIM_SUBMITTED:   'Claim Submitted',
  CLAIM_UNDER_AUDIT: 'Under Audit',
  CLAIM_APPROVED:    'Claim Approved',
  CLAIM_REJECTED:    'Claim Rejected',
  DISCHARGED:        'Discharged',
}
