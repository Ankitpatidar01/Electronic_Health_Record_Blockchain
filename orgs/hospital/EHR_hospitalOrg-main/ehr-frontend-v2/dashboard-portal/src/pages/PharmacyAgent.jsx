import React from 'react'
import { ClinicalAgentPage } from '../components/ClinicalAgentPage'
import { agentConfig } from '../config/agentConfig'
export default function PharmacyAgent() {
  return <ClinicalAgentPage agentId="pharmacy-agent" config={agentConfig['pharmacy-agent']} />
}
