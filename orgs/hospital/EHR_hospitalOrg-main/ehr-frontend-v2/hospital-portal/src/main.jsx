import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Patients from './pages/Patients'
import Visits from './pages/Visits'
import OpenVisit from './pages/OpenVisit'
import DoctorVisits from './pages/DoctorVisits'
import NurseVisits from './pages/NurseVisits'
import { PharmacistPage, MedRecordsPage } from './pages/PharmacistRecords'
import Staff from './pages/Staff'
import LabQueue from './pages/LabQueue'
import './index.css'
import './design-system/observatory-theme.css'

function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to default page for their role
    const defaults = {
      receptionist: '/patients', admin: '/patients',
      doctor: '/my-visits', nurse: '/my-visits',
      pharmacist: '/dispense', medrecordofficer: '/finalize',
      labreceptionist: '/lab-queue', labtechnician: '/lab-queue',
      radiologist: '/lab-queue', labsupervisor: '/lab-queue', labadmin: '/lab-queue',
    }
    return <Navigate to={defaults[user.role] || '/patients'} replace />
  }
  return children
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/gateway" element={<Login />} />

      {/* Protected routes with Layout */}
      {/* Receptionist / Admin */}
      <Route path="/patients" element={
        <ProtectedRoute allowedRoles={['receptionist','admin']}>
          <Layout><Patients /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/visits" element={
        <ProtectedRoute allowedRoles={['receptionist','admin']}>
          <Layout><Visits /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/visits/:id" element={
        <ProtectedRoute allowedRoles={['receptionist','admin']}>
          <Layout><Visits /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/register" element={
        <ProtectedRoute allowedRoles={['receptionist','admin']}>
          <Layout><Patients /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/open-visit" element={
        <ProtectedRoute allowedRoles={['receptionist','admin']}>
          <Layout><OpenVisit /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/discharge" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout><Visits /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/staff" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout><Staff /></Layout>
        </ProtectedRoute>
      } />

      {/* Doctor */}
      <Route path="/my-visits" element={
        <ProtectedRoute allowedRoles={['doctor','nurse']}>
          <Layout>
            {user?.role === 'doctor' ? <DoctorVisits /> : <NurseVisits />}
          </Layout>
        </ProtectedRoute>
      } />

      {/* Pharmacist */}
      <Route path="/dispense" element={
        <ProtectedRoute allowedRoles={['pharmacist']}>
          <Layout><PharmacistPage /></Layout>
        </ProtectedRoute>
      } />

      {/* Medical Records */}
      <Route path="/finalize" element={
        <ProtectedRoute allowedRoles={['medrecordofficer']}>
          <Layout><MedRecordsPage /></Layout>
        </ProtectedRoute>
      } />

      {/* Diagnostic Lab Orders Queue */}
      <Route path="/lab-queue" element={
        <ProtectedRoute allowedRoles={['labreceptionist','labtechnician','radiologist','labsupervisor','labadmin','admin','doctor']}>
          <Layout><LabQueue /></Layout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
