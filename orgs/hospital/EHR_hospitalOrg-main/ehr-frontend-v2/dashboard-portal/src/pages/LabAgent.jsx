import React from 'react'
import { ClinicalAgentPage } from '../components/ClinicalAgentPage'
import { agentConfig } from '../config/agentConfig'
export default function LabAgent() {
  return <ClinicalAgentPage agentId="lab-agent" config={agentConfig['lab-agent']} />
}
