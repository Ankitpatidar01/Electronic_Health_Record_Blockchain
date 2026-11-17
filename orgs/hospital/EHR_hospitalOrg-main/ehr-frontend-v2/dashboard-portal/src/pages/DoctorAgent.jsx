import React from 'react'
import { ClinicalAgentPage } from '../components/ClinicalAgentPage'
import { agentConfig } from '../config/agentConfig'
export default function DoctorAgent() {
  return <ClinicalAgentPage agentId="doctor-agent" config={agentConfig['doctor-agent']} />
}
