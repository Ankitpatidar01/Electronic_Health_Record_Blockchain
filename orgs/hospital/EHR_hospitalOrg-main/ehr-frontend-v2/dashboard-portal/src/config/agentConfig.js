// Agent and peer configuration for the dashboard.
// The four clinical agentic peers (doctor, nurse, pharmacy, lab) are first-class entities per the Group 1 spec.
export const agentConfig = {
  // ── Four Agentic Peers (Group 1 — first-class entities) ──────────────────
  'doctor-agent': {
    title: 'Doctor Agent',
    agentId: 'doctor-agent',
    peer: 'peer1.hospital.example.com:9051',
    kind: 'ai',
    org: 'HospitalMSP',
    agentType: 'DOCTOR',
    metrics: ['activeVisits', 'aiRequests', 'successRate', 'averageLatency'],
    domainMetrics: {
      activeVisits: 'Active Visits',
      aiRequests: 'AI Requests',
      successRate: 'Success Rate',
      averageLatency: 'Avg Latency',
    },
    activityEventTypes: ['AGENT_EXECUTION_STARTED', 'AGENT_EXECUTION_COMPLETED', 'AGENT_EXECUTION_FAILED', 'CONSENT_GRANTED', 'ACCESS_DENIED', 'VCAP_VERIFIED', 'VCAP_MISMATCH'],
    color: 'blue',
  },
  'nurse-agent': {
    title: 'Nurse Agent',
    agentId: 'nurse-agent',
    peer: 'peer2.hospital.example.com:10051',
    kind: 'logical',
    org: 'HospitalMSP',
    agentType: 'NURSE',
    metrics: ['activePatients', 'vitalsRecorded', 'aiRequests', 'averageLatency'],
    domainMetrics: {
      activePatients: 'Active Patients',
      vitalsRecorded: 'Vitals Recorded',
      aiRequests: 'AI Requests',
      averageLatency: 'Avg Latency',
    },
    activityEventTypes: ['AGENT_EXECUTION_STARTED', 'AGENT_EXECUTION_COMPLETED', 'AGENT_EXECUTION_FAILED', 'ACCESS_DENIED', 'CONSENT_REVOKED'],
    color: 'emerald',
  },
  'pharmacy-agent': {
    title: 'Pharmacy Agent',
    agentId: 'pharmacy-agent',
    peer: 'peer2.hospital.example.com:10051',
    kind: 'logical',
    org: 'HospitalMSP',
    agentType: 'PHARMACY',
    metrics: ['prescriptions', 'dispensed', 'failedTransactions', 'averageLatency'],
    domainMetrics: {
      prescriptions: 'Prescriptions',
      dispensed: 'Dispensed',
      failedTransactions: 'Failed Txns',
      averageLatency: 'Avg Latency',
    },
    activityEventTypes: ['TRANSACTION_COMMITTED', 'TRANSACTION_FAILED', 'MVCC_CONFLICT', 'ACCESS_DENIED'],
    color: 'violet',
  },
  'lab-agent': {
    title: 'Lab Agent',
    agentId: 'lab-agent',
    peer: 'peer0.diagnostic.example.com:8051',
    kind: 'ai',
    org: 'DiagnosticsMSP',
    agentType: 'LAB',
    metrics: ['reports', 'aiAnalyses', 'successRate', 'averageLatency'],
    domainMetrics: {
      reports: 'Reports Today',
      aiAnalyses: 'AI Analyses',
      successRate: 'Success Rate',
      averageLatency: 'Avg Latency',
    },
    activityEventTypes: ['AGENT_EXECUTION_STARTED', 'AGENT_EXECUTION_COMPLETED', 'AGENT_EXECUTION_FAILED', 'IPFS_UPLOAD_COMPLETED', 'VCAP_ANCHORED', 'TRANSACTION_COMMITTED'],
    pipelineStages: ['Reports', 'Parse/OCR', 'AI Triage', 'IPFS', 'VCAP', 'Fabric'],
    color: 'cyan',
  },

  // ── Hyperledger Fabric Peer Nodes ──────────────────────────────────────────
  'peer0.hospital': {
    title: 'Hospital Reception & Admin',
    peer: 'peer0.hospital.example.com:7051',
    kind: 'peer',
    org: 'HospitalMSP',
    metrics: ['activeVisits', 'prescriptions', 'failedTransactions'],
  },
  'peer1.hospital': {
    title: 'Doctor & Clinical Peer',
    peer: 'peer1.hospital.example.com:9051',
    kind: 'peer',
    org: 'HospitalMSP',
    metrics: ['prescriptions', 'activePatients', 'failedTransactions'],
  },
  'peer2.hospital': {
    title: 'Nurse & Dispensary Peer',
    peer: 'peer2.hospital.example.com:10051',
    kind: 'peer',
    org: 'HospitalMSP',
    metrics: ['vitalsRecorded', 'dispensed', 'failedTransactions'],
  },
  'peer0.diagnostic': {
    title: 'Diagnostics & Lab Peer',
    peer: 'peer0.diagnostic.example.com:8051',
    kind: 'peer',
    org: 'DiagnosticsMSP',
    metrics: ['reports', 'uploads', 'failedTransactions'],
  },
  'peer0.provider': {
    title: 'Insurance & Billing Peer',
    peer: 'peer0.provider.example.com:11051',
    kind: 'peer',
    org: 'ProviderMSP',
    metrics: ['approved', 'rejected', 'failedTransactions'],
  },

  // ── AI Agents ──────────────────────────────────────────────────────────────
  'clinical-agent': {
    title: 'Clinical Decision Agent',
    agentId: 'clinical-agent-v2',
    kind: 'ai',
    org: 'HospitalMSP',
    metrics: ['runs', 'toolCalls', 'averageLatency', 'humanReviewRate'],
  },
  'governance-agent': {
    title: 'Governance & Audit Agent',
    agentId: 'governance-guard-v1',
    kind: 'ai',
    org: 'HospitalMSP',
    metrics: ['runs', 'approved', 'rejected', 'humanReviewRequired'],
  },
};

// The four clinical agentic peers required by Group 1 spec
export const CLINICAL_AGENTS = ['doctor-agent', 'nurse-agent', 'pharmacy-agent', 'lab-agent'];
