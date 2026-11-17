import React from 'react'
import { ClinicalAgentPage } from '../components/ClinicalAgentPage'
import { agentConfig } from '../config/agentConfig'
export default function NurseAgent() {
  return <ClinicalAgentPage agentId="nurse-agent" config={agentConfig['nurse-agent']} />
}
