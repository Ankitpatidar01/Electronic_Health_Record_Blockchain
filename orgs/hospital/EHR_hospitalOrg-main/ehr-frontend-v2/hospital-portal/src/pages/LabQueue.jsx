import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import {
  FlaskConical,
  TestTube2,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  FileText,
  User,
  Stethoscope,
  ChevronRight,
  ExternalLink,
  Plus,
  Trash2,
  ShieldCheck,
  Bot
} from 'lucide-react'
import { Card, Button, Modal, Alert, EmptyState } from '../components/ui'
import Avatar from '../design-system/components/Avatar'
import { analyzeReportWithAI } from '../utils/api'

export default function LabQueue() {
  const { user, token } = useAuth()
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [filter, setFilter] = useState('ALL') // ALL, REQUESTED, ACKNOWLEDGED, COMPLETED, APPROVED

  // Modal State for Entering Findings (Step B)
  const [activeModal, setActiveModal] = useState(null) // { visit, req }
  const [findingsFields, setFindingsFields] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiReport, setAiReport] = useState(null)
  const [autoApprove, setAutoApprove] = useState(true)

  const extClient = axios.create({ baseURL: '/api/hospital/ext' })
  if (token) extClient.defaults.headers.common['Authorization'] = `Bearer ${token}`

  const fetchVisits = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await extClient.get('/lab/visits')
      if (res.data.success) {
        setVisits(res.data.data || [])
      }
    } catch (err) {
      console.error('Fetch lab visits error:', err)
      setError(err.response?.data?.error || 'Failed to fetch lab orders queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVisits()
  }, [])

  // Flatten all lab requests across all visits
  const allOrders = []
  visits.forEach(v => {
    const requests = v.clinical?.labRequests || []
    requests.forEach(lr => {
      allOrders.push({
        visit: v,
        req: lr
      })
    })
  })

  const filteredOrders = allOrders.filter(item => {
    if (filter === 'ALL') return true
    return item.req.status === filter
  })

  // ── Step A: Acknowledge Order ──────────────────────────────────────────────
  const handleAcknowledge = async (visitId, labRequestId) => {
    setStatusMsg('')
    setError('')
    try {
      await extClient.put(`/lab/visits/${visitId}/request/${labRequestId}/acknowledge`)
      setStatusMsg(`Order ${labRequestId} acknowledged successfully! Ready for test processing.`)
      await fetchVisits()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to acknowledge lab order')
    }
  }

  // ── Step B: Open Findings Modal ────────────────────────────────────────────
  const openFindingsModal = (visit, req) => {
    setActiveModal({ visit, req })
    setAiReport(null)

    // Pre-populate fields based on requested tests
    const defaultFields = []
    const tests = req.tests || []

    if (tests.some(t => /cbc|blood/i.test(t))) {
      defaultFields.push({ key: 'Hemoglobin', value: '13.5 g/dL' })
      defaultFields.push({ key: 'Platelet Count', value: '240,000 /uL' })
      defaultFields.push({ key: 'WBC Count', value: '6,800 /uL' })
    }
    if (tests.some(t => /sugar|glucose|hba1c/i.test(t))) {
      defaultFields.push({ key: 'Fasting Blood Glucose', value: '98 mg/dL' })
      defaultFields.push({ key: 'HbA1c', value: '5.6 %' })
    }
    if (tests.some(t => /dengue|ns1/i.test(t))) {
      defaultFields.push({ key: 'Dengue NS1 Antigen', value: 'Negative' })
      defaultFields.push({ key: 'Dengue IgM/IgG', value: 'Negative' })
    }
    if (tests.some(t => /x-ray|chest/i.test(t))) {
      defaultFields.push({ key: 'Chest X-Ray Findings', value: 'Bilateral lung fields clear. Normal cardiac silhouette.' })
    }

    if (defaultFields.length === 0) {
      tests.forEach(t => {
        defaultFields.push({ key: t, value: 'Normal / Within baseline' })
      })
    }

    // If existing results already present, use those
    if (req.results && Object.keys(req.results).length > 0) {
      const existing = Object.entries(req.results).map(([k, v]) => ({ key: k, value: String(v) }))
      setFindingsFields(existing)
    } else {
      setFindingsFields(defaultFields)
    }
  }

  // ── Step B Demo Fill Helper ────────────────────────────────────────────────
  const fillDemoAbnormal = () => {
    setFindingsFields([
      { key: 'Hemoglobin (Hb)', value: '9.1 g/dL (Low)' },
      { key: 'Platelet Count', value: '95,000 /uL (Low)' },
      { key: 'WBC Count', value: '11,200 /uL (Elevated)' },
      { key: 'Fasting Blood Glucose', value: '142 mg/dL (High)' },
      { key: 'Dengue IgM Antibody', value: 'Positive (Elevated)' },
      { key: 'Chest X-Ray', value: 'Clear lung fields, no active parenchymal lesion' }
    ])
    setAiReport(null)
  }

  // ── AI Diagnostics Analysis ────────────────────────────────────────────────
  const runAiAnalysis = async () => {
    setAiLoading(true)
    setError('')
    try {
      const textSummary = findingsFields.map(f => `${f.key}: ${f.value}`).join('. ')
      const reportText = `Patient: ${activeModal.visit.patientId}. Tests: ${activeModal.req.tests?.join(', ')}. Findings: ${textSummary}`
      const result = await analyzeReportWithAI(reportText, activeModal.visit.patientId, activeModal.req.tests?.join(', ') || 'Lab Panel')
      setAiReport(result)
    } catch (err) {
      console.error('AI Analysis failed:', err)
      setError('AI agent service unavailable on port 8000')
    } finally {
      setAiLoading(false)
    }
  }

  // ── Step B Commit Findings to Ledger ───────────────────────────────────────
  const handleSubmitFindings = async (e) => {
    e.preventDefault()
    if (!activeModal) return
    setSubmitting(true)
    setError('')
    setStatusMsg('')

    try {
      const resultsObj = {}
      findingsFields.forEach(f => {
        if (f.key.trim()) {
          resultsObj[f.key.trim()] = f.value.trim()
        }
      })

      if (aiReport) {
        resultsObj['aiProvenanceHash'] = aiReport.provenance_hash || ''
        resultsObj['aiAbnormalitiesFlagged'] = (aiReport.abnormalities_flagged || []).join('; ')
        resultsObj['aiSuggestedFollowups'] = (aiReport.suggested_followups || []).join('; ')
      }

      const { visit, req } = activeModal

      // 1. Submit results (Step B)
      await extClient.put(`/lab/visits/${visit.visitId}/request/${req.labRequestId}/submit`, {
        results: resultsObj,
        resultsHash: aiReport?.provenance_hash || ''
      })

      // 2. Auto-approve & return to doctor if checked (Step C & D)
      if (autoApprove) {
        await extClient.put(`/lab/visits/${visit.visitId}/request/${req.labRequestId}/approve`)
        await extClient.put(`/lab/visits/${visit.visitId}/request/${req.labRequestId}/return`)
        setStatusMsg(`Findings for ${req.labRequestId} endorsed to blockchain and returned to Dr. ${visit.assignedDoctor || 'Smith'}!`)
      } else {
        setStatusMsg(`Findings for ${req.labRequestId} submitted to blockchain (Status: COMPLETED). Pending supervisor approval.`)
      }

      setActiveModal(null)
      await fetchVisits()
    } catch (err) {
      console.error('Submit findings error:', err)
      setError(err.response?.data?.error || 'Failed to submit test findings')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Step C: Approve & Return Directly ──────────────────────────────────────
  const handleApproveAndReturn = async (visitId, labRequestId, doctorId) => {
    setStatusMsg('')
    setError('')
    try {
      await extClient.put(`/lab/visits/${visitId}/request/${labRequestId}/approve`)
      await extClient.put(`/lab/visits/${visitId}/request/${labRequestId}/return`)
      setStatusMsg(`Order ${labRequestId} approved and returned to Dr. ${doctorId || 'physician'}!`)
      await fetchVisits()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve lab result')
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25">
            <FlaskConical size={26} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight font-display">
              Diagnostic Laboratory Orders Queue
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Fulfill clinical physician lab orders, accession specimens, run AI interpretations, and endorse findings to Fabric LabMSP.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <a
            href="/lab/"
            target="_blank"
            rel="noreferrer"
            className="obs-btn-ghost text-xs flex items-center gap-1.5"
            title="Open standalone CareGrid Lab Deck on Port 3006"
          >
            <span>Lab Deck Workstation</span>
            <ExternalLink size={13} />
          </a>
          <Button variant="secondary" size="sm" onClick={fetchVisits} loading={loading} className="gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {statusMsg && <Alert type="success">{statusMsg}</Alert>}
      {error && <Alert type="error">{error}</Alert>}

      {/* Filter Tabs & Quick Counters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
          {[
            { id: 'ALL', label: 'All Orders', count: allOrders.length },
            { id: 'REQUESTED', label: 'Step A: Intake (Requested)', count: allOrders.filter(o => o.req.status === 'REQUESTED').length },
            { id: 'ACKNOWLEDGED', label: 'Step B: Processing', count: allOrders.filter(o => o.req.status === 'ACKNOWLEDGED').length },
            { id: 'COMPLETED', label: 'Step C: Review', count: allOrders.filter(o => o.req.status === 'COMPLETED').length },
            { id: 'APPROVED', label: 'Finalized & With Doctor', count: allOrders.filter(o => o.req.status === 'APPROVED').length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filter === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                filter === tab.id
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Fabric Gateway: <span className="text-amber-600 dark:text-amber-400 font-semibold">peer0.diagnostic.example.com</span>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card className="p-12 text-center">
          <EmptyState
            icon={FlaskConical}
            title={filter === 'ALL' ? 'No Lab Orders in Queue' : `No orders with status "${filter}"`}
            desc={filter === 'ALL'
              ? 'When a doctor orders lab tests in their consultation visit, they will appear here in real-time.'
              : 'Try selecting "All Orders" to view other stages of the diagnostic pipeline.'}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredOrders.map(({ visit, req }) => {
            const isRequested = req.status === 'REQUESTED'
            const isAck = req.status === 'ACKNOWLEDGED'
            const isCompleted = req.status === 'COMPLETED'
            const isApproved = req.status === 'APPROVED'

            const statusBadgeConfig = {
              REQUESTED:    { bg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/40', label: 'Step A: Intake Required' },
              ACKNOWLEDGED: { bg: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-400/40', label: 'Step B: Specimen In Testing' },
              COMPLETED:    { bg: 'bg-blue-500/15 text-blue-700 dark:text-sky-300 border-blue-400/40', label: 'Step C: Findings Ready for Review' },
              APPROVED:     { bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/40', label: 'Returned to Doctor Chart' },
            }[req.status] || { bg: 'bg-slate-100 text-slate-600 border-slate-300', label: req.status }

            return (
              <div
                key={req.labRequestId}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <Avatar id={visit.patientId} name={visit.patientId} size={40} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                          {req.labRequestId}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">·</span>
                        <span className="text-xs font-semibold text-blue-600 dark:text-sky-400 font-mono">
                          {visit.patientId}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">·</span>
                        <span className="text-xs text-slate-400 font-mono">
                          {visit.visitId}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Chief Complaint: <span className="text-slate-700 dark:text-slate-300 font-medium">{visit.clinical?.chiefComplaint || 'Consultation'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadgeConfig.bg}`}>
                      {statusBadgeConfig.label}
                    </span>
                    <div className="text-right hidden sm:block">
                      <p className="text-[11px] text-slate-400">Ordering Physician</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Dr. {visit.assignedDoctor || 'Smith'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tests Requested Badges */}
                <div className="py-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Requested Diagnostic Tests ({req.tests?.length || 0})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(req.tests || []).map((t, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-300/40"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {req.instructions && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">Doctor's Clinical Instructions: </span>
                      {req.instructions}
                    </div>
                  )}

                  {/* Display existing results if already submitted */}
                  {req.results && Object.keys(req.results).length > 0 && (
                    <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Committed Laboratory Findings
                        </span>
                        {req.submittedBy && (
                          <span className="text-[11px] font-mono text-slate-400">
                            Technician: {req.submittedBy}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {Object.entries(req.results).map(([k, v]) => {
                          if (k.startsWith('ai')) return null
                          return (
                            <div key={k} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-xs">
                              <span className="text-slate-400 block">{k}</span>
                              <span className="font-semibold text-slate-900 dark:text-white font-mono mt-0.5 block">{String(v)}</span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Display AI flags if present */}
                      {req.results.aiAbnormalitiesFlagged && (
                        <div className="mt-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-xs">
                          <span className="font-bold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                            <Bot size={13} /> AI Flagged Abnormalities:
                          </span>
                          <p className="text-red-600 dark:text-red-300 mt-0.5">{req.results.aiAbnormalitiesFlagged}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Handshake Buttons (Steps A, B, C) */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-400">
                    Requested on: {new Date(req.requestedAt).toLocaleString()}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Step A Button */}
                    {isRequested && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleAcknowledge(visit.visitId, req.labRequestId)}
                        className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                      >
                        <CheckCircle2 size={14} />
                        <span>Step A: Acknowledge Sample Intake</span>
                      </Button>
                    )}

                    {/* Step B Button */}
                    {(isAck || isRequested) && (
                      <Button
                        size="sm"
                        variant={isAck ? 'primary' : 'secondary'}
                        onClick={() => openFindingsModal(visit, req)}
                        className="gap-1.5"
                      >
                        <TestTube2 size={14} />
                        <span>Step B: Enter Findings &amp; AI Analysis</span>
                      </Button>
                    )}

                    {/* Step C Button */}
                    {isCompleted && (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => handleApproveAndReturn(visit.visitId, req.labRequestId, visit.assignedDoctor)}
                        className="gap-1.5"
                      >
                        <CheckCircle2 size={14} />
                        <span>Step C: Approve &amp; Return to Doctor</span>
                      </Button>
                    )}

                    {isApproved && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 size={14} />
                        <span>Available in Dr. {visit.assignedDoctor}'s Chart</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal for Entering Findings (Step B) */}
      {activeModal && (
        <Modal
          open={Boolean(activeModal)}
          onClose={() => setActiveModal(null)}
          title={`Enter Test Findings — ${activeModal.req.labRequestId}`}
          size="lg"
        >
          <form onSubmit={handleSubmitFindings} className="space-y-5">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Order for Patient</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {activeModal.visit.patientId} · Visit {activeModal.visit.visitId}
                </p>
              </div>
              <button
                type="button"
                onClick={fillDemoAbnormal}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-300 hover:bg-amber-500/20 transition-colors"
                title="Populate realistic abnormal values to test AI scan"
              >
                ⚡ Fill Demo Values
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Diagnostic Measurement Findings
                </label>
                <button
                  type="button"
                  onClick={() => setFindingsFields(prev => [...prev, { key: '', value: '' }])}
                  className="text-xs text-blue-600 dark:text-sky-400 font-semibold flex items-center gap-1 hover:underline"
                >
                  <Plus size={13} /> Add Metric
                </button>
              </div>

              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {findingsFields.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={f.key}
                      onChange={e => {
                        const updated = [...findingsFields]
                        updated[idx].key = e.target.value
                        setFindingsFields(updated)
                      }}
                      placeholder="e.g. Hemoglobin / Fasting Sugar"
                      required
                      className="w-1/2 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <input
                      type="text"
                      value={f.value}
                      onChange={e => {
                        const updated = [...findingsFields]
                        updated[idx].value = e.target.value
                        setFindingsFields(updated)
                      }}
                      placeholder="e.g. 13.8 g/dL / Normal"
                      required
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setFindingsFields(prev => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-red-500 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Agent Integration Trigger */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-sky-500/10 dark:from-indigo-950/30 dark:to-sky-950/30 border border-indigo-200/60 dark:border-indigo-800/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Bot size={18} className="text-indigo-600 dark:text-sky-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Autonomous Clinical AI Agent
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Extract markers, flag diagnostic abnormalities &amp; generate cryptographic provenance
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={runAiAnalysis}
                  loading={aiLoading}
                  className="gap-1.5 bg-white dark:bg-slate-900 border-indigo-200 text-indigo-700 dark:text-sky-300"
                >
                  <Sparkles size={13} />
                  <span>Run AI Scan</span>
                </Button>
              </div>

              {aiReport && (
                <div className="mt-3 pt-3 border-t border-indigo-200/60 dark:border-indigo-800/60 space-y-2 text-xs">
                  {aiReport.abnormalities_flagged?.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-800 dark:text-red-300">
                      <span className="font-bold block mb-1">🚨 Flagged Abnormalities:</span>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {aiReport.abnormalities_flagged.map((ab, i) => (
                          <li key={i}>{ab}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiReport.suggested_followups?.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-sky-950/40 border border-blue-200 text-blue-800 dark:text-sky-300">
                      <span className="font-bold block mb-1">💡 Suggested Follow-ups:</span>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {aiReport.suggested_followups.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
                    <span>Provenance Hash: {aiReport.provenance_hash?.slice(0, 20)}...</span>
                    <span className="text-emerald-600 font-bold">✓ Verified</span>
                  </div>
                </div>
              )}
            </div>

            {/* Auto-Approve Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={e => setAutoApprove(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
              />
              <span className="font-medium">
                Auto-approve and return findings directly to Dr. {activeModal.visit.assignedDoctor}'s consultation chart
              </span>
            </label>

            {/* Submit Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="secondary" onClick={() => setActiveModal(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={submitting} className="gap-1.5">
                <CheckCircle2 size={14} />
                <span>Commit Findings to Fabric Ledger</span>
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
