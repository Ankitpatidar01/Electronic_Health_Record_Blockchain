import { createContext, useContext, useState, useCallback } from 'react'
import { createPatientClient, createDigilockerClient } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [patient, setPatient] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ehr_patient_user')) } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('ehr_patient_token') || null)

  const logout = useCallback(() => {
    setToken(null)
    setPatient(null)
    localStorage.removeItem('ehr_patient_token')
    localStorage.removeItem('ehr_patient_user')
  }, [])

  // An expired or rejected token signs the patient out instead of leaving
  // every page failing silently.
  const api = useCallback(() => createPatientClient(token, logout), [token, logout])
  const digilocker = useCallback(() => createDigilockerClient(token, logout), [token, logout])

  const login = async (patientId, password) => {
    const client = createPatientClient(null)
    const res = await client.post('/auth/login', { patientId, password })
    const { token: t, patient: p } = res.data.data
    setToken(t)
    setPatient({ ...p, patientId })
    localStorage.setItem('ehr_patient_token', t)
    localStorage.setItem('ehr_patient_user', JSON.stringify({ ...p, patientId }))
    return res.data.data
  }

  const register = async (patientId, password, email, phone) => {
    const client = createPatientClient(null)
    const res = await client.post('/auth/register', { patientId, password, email, phone })
    const { token: t, patient: p } = res.data.data
    setToken(t)
    setPatient({ ...p, patientId })
    localStorage.setItem('ehr_patient_token', t)
    localStorage.setItem('ehr_patient_user', JSON.stringify({ ...p, patientId }))
    return res.data.data
  }

  return (
    <AuthContext.Provider value={{ patient, token, api, digilocker, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
